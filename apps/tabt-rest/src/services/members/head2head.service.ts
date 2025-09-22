import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

import { MatchService } from '../matches/match.service';
import { TeamMatchesEntry } from '../../entity/tabt-soap/TabTAPI_Port';
import { CacheService, TTL_DURATION } from '../../common/cache/cache.service';
import { SocksProxyHttpClient } from '../../common/socks-proxy/socks-proxy-http-client';
import { UserAgentsUtil } from '../../common/utils/user-agents.util';

// Constants
const AFTT_BASE_URL = 'https://resultats.aftt.be/index.php';
const CACHE_PREFIX = 'head2head';
const QUERY_PARAMS = ['season', 'week_name', 'div_id'];

// Interfaces
export interface ExtractedMatchInfo {
  weekName?: string;
  divisionId?: number;
  season?: number;
  matchId: string;
}

export class PlayersInfo {
  @ApiProperty()
  playerUniqueIndex: number;

  @ApiProperty()
  opponentPlayerUniqueIndex: number;

  @ApiProperty()
  playerName: string;

  @ApiProperty()
  opponentPlayerName: string;
}

export class MatchEntryHistory {
  @ApiPropertyOptional()
  season?: number;

  @ApiProperty()
  date: Date;

  @ApiProperty({ type: TeamMatchesEntry })
  matchEntry: TeamMatchesEntry;

  @ApiProperty()
  playerRanking: string;

  @ApiProperty()
  opponentRanking: string;

  @ApiProperty()
  score?: string;
}

export class Head2HeadData {
  @ApiProperty()
  head2HeadCount: number;

  @ApiProperty()
  victoryCount: number;

  @ApiProperty()
  defeatCount: number;

  @ApiPropertyOptional()
  lastVictory?: Date;

  @ApiPropertyOptional()
  lastDefeat?: Date;

  @ApiPropertyOptional()
  firstVictory?: Date;

  @ApiProperty({ type: [MatchEntryHistory] })
  matchEntryHistory: MatchEntryHistory[];

  @ApiProperty({ type: PlayersInfo })
  playersInfo: PlayersInfo;
}

@Injectable()
export class Head2headService {
  private readonly logger = new Logger(Head2headService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly matchService: MatchService,
    private readonly cacheService: CacheService,
    private readonly socksProxyService: SocksProxyHttpClient,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Retrieves head-to-head results between two players
   * @param playerUniqueIndex - The unique index of the first player
   * @param opponentPlayerUniqueIndex - The unique index of the second player
   * @returns Promise<Head2HeadData> - The head-to-head statistics and match history
   */
  public async getHead2HeadResults(
    playerUniqueIndex: number,
    opponentPlayerUniqueIndex: number,
  ): Promise<Head2HeadData> {
    const cacheKey = `${CACHE_PREFIX}:${playerUniqueIndex}-${opponentPlayerUniqueIndex}`;

    const getter = async (): Promise<Head2HeadData> => {
      try {
        const htmlPage = await this.getPageFromAFTT(
          playerUniqueIndex,
          opponentPlayerUniqueIndex,
        );
        const matchesExtracted = this.extractMatchesInfos(htmlPage);
        const playersInfo = this.extractPlayerNames(htmlPage);

        if (matchesExtracted.length === 0) {
          return this.createEmptyHead2HeadData(playersInfo);
        }

        const matchesFound = await Promise.all(
          matchesExtracted.map((m) => this.getMatchDetails(m)),
        );

        const teamMatchEntries = matchesFound.filter(
          (match): match is TeamMatchesEntry => !!match,
        );

        if (teamMatchEntries.length === 0) {
          return this.createEmptyHead2HeadData(playersInfo);
        }

        return this.calculateHead2Head(
          teamMatchEntries,
          matchesExtracted,
          playersInfo,
        );
      } catch (error) {
        this.logger.error(
          `Failed to get head-to-head results: ${error.message}`,
          error.stack,
        );
        throw error;
      }
    };

    return this.cacheService.getFromCacheOrGetAndCacheResult(
      cacheKey,
      getter,
      TTL_DURATION.EIGHT_HOURS,
    );
  }

  /**
   * Fetches the AFTT page containing head-to-head information
   */
  private async getPageFromAFTT(
    playerA: number,
    playerB: number,
  ): Promise<string> {
    try {
      const result = await firstValueFrom(
        this.httpService.post(
          `${AFTT_BASE_URL}?menu=4&head=1&player_1=${playerA}&player_2=${playerB}`,
          {
            responseType: 'text',
            maxRedirects: 0,
          },
          {
            headers: {
              'user-agent': UserAgentsUtil.random,
            },
            httpsAgent: this.socksProxyService.createHttpsAgent(),
          },
        ),
      );
      return result.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch AFTT page: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to fetch data from AFTT');
    }
  }

  /**
   * Extracts match information from the AFTT HTML page
   */
  private extractMatchesInfos(htmlPage: string): ExtractedMatchInfo[] {
    const regex =
      /season=([0-9]+)&sel=([0-9]+)&detail=([0-9]+)&week_name=([0-9]+)&div_id=([0-9]+)">Match ([0-2]\d\/\d+)/gm;
    const matches: ExtractedMatchInfo[] = [];

    let match: RegExpExecArray | null;
    while ((match = regex.exec(htmlPage)) !== null) {
      matches.push({
        matchId: match[6],
        weekName: match[4],
        divisionId: Number(match[5]),
        season: Number(match[1]),
      });
    }

    return matches;
  }

  /**
   * Extracts player names and unique indexes from the AFTT HTML page
   */
  private extractPlayerNames(htmlPage: string): PlayersInfo {
    const regex =
      /id="player_[0-9]" name="player_[0-9]" value="([0-9]+)\/(.+)"/gm;
    const players: Array<[string, string]> = [];

    let match: RegExpExecArray | null;
    while ((match = regex.exec(htmlPage)) !== null) {
      players.push([match[1], match[2]]);
    }

    if (players.length !== 2) {
      throw new Error('Failed to extract player information');
    }

    return {
      playerName: players[0][1],
      playerUniqueIndex: Number(players[0][0]),
      opponentPlayerName: players[1][1],
      opponentPlayerUniqueIndex: Number(players[1][0]),
    };
  }

  /**
   * Retrieves detailed match information
   */
  private async getMatchDetails(
    matchExtracted: ExtractedMatchInfo,
  ): Promise<TeamMatchesEntry | undefined> {
    try {
      const matches = await this.matchService.getMatches({
        DivisionId: matchExtracted.divisionId,
        Season: matchExtracted.season,
        WeekName: matchExtracted.weekName,
        WithDetails: true,
      });

      return matches.find((match) => match.MatchId === matchExtracted.matchId);
    } catch (error) {
      this.logger.warn(`Failed to get match details: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Creates an empty head-to-head data object
   */
  private createEmptyHead2HeadData(playersInfo: PlayersInfo): Head2HeadData {
    return {
      playersInfo,
      head2HeadCount: 0,
      victoryCount: 0,
      defeatCount: 0,
      matchEntryHistory: [],
    };
  }

  /**
   * Calculates head-to-head statistics from match entries
   */
  private calculateHead2Head(
    teamMatchEntries: TeamMatchesEntry[],
    extractedMatches: ExtractedMatchInfo[],
    playersInfo: PlayersInfo,
  ): Head2HeadData {
    const head2HeadCount = teamMatchEntries.length;
    let victoryCount = 0;
    let defeatCount = 0;
    let lastVictory: Date | undefined;
    let firstVictory: Date | undefined;
    let lastDefeat: Date | undefined;
    const matchEntryHistory: MatchEntryHistory[] = [];

    for (const match of teamMatchEntries) {
      const linkedExtractedMatch = extractedMatches.find(
        (m) => m.matchId === match.MatchId,
      );

      if (!linkedExtractedMatch) {
        continue;
      }

      const isHomePlayer = match.MatchDetails.HomePlayers.Players.some(
        (p) => p.UniqueIndex === playersInfo.playerUniqueIndex,
      );

      const player = this.findPlayer(
        match,
        playersInfo.playerUniqueIndex,
        isHomePlayer,
      );
      const opponent = this.findPlayer(
        match,
        playersInfo.opponentPlayerUniqueIndex,
        !isHomePlayer,
      );

      if (!player || !opponent) {
        continue;
      }

      const individualResult = this.findIndividualResult(
        match,
        playersInfo,
        isHomePlayer,
      );
      const score = this.calculateScore(individualResult, isHomePlayer);

      if (individualResult) {
        const stats = this.updateVictoryStats(
          individualResult,
          isHomePlayer,
          match.Date,
          victoryCount,
          defeatCount,
          lastVictory,
          firstVictory,
          lastDefeat,
        );
        victoryCount = stats.victoryCount;
        defeatCount = stats.defeatCount;
        lastVictory = stats.lastVictory;
        firstVictory = stats.firstVictory;
        lastDefeat = stats.lastDefeat;
      }

      matchEntryHistory.push({
        season: linkedExtractedMatch.season,
        date: new Date(match.Date),
        matchEntry: match,
        playerRanking: player.Ranking,
        opponentRanking: opponent.Ranking,
        score,
      });
    }

    return {
      head2HeadCount,
      defeatCount,
      victoryCount,
      lastVictory,
      firstVictory,
      lastDefeat,
      matchEntryHistory,
      playersInfo,
    };
  }

  /**
   * Finds a player in a match
   */
  private findPlayer(
    match: TeamMatchesEntry,
    uniqueIndex: number,
    isHome: boolean,
  ) {
    const players = isHome
      ? match.MatchDetails.HomePlayers.Players
      : match.MatchDetails.AwayPlayers.Players;

    return players.find((p) => p.UniqueIndex === uniqueIndex);
  }

  /**
   * Finds individual match result
   */
  private findIndividualResult(
    match: TeamMatchesEntry,
    playersInfo: PlayersInfo,
    isHomePlayer: boolean,
  ) {
    return match.MatchDetails.IndividualMatchResults.find((individualMatch) =>
      isHomePlayer
        ? individualMatch.HomePlayerUniqueIndex.includes(
            playersInfo.playerUniqueIndex,
          ) &&
          individualMatch.AwayPlayerUniqueIndex.includes(
            playersInfo.opponentPlayerUniqueIndex,
          )
        : individualMatch.AwayPlayerUniqueIndex.includes(
            playersInfo.playerUniqueIndex,
          ) &&
          individualMatch.HomePlayerUniqueIndex.includes(
            playersInfo.opponentPlayerUniqueIndex,
          ),
    );
  }

  /**
   * Calculates the score string
   */
  private calculateScore(
    individualResult: any,
    isHomePlayer: boolean,
  ): string | undefined {
    if (!individualResult) {
      return undefined;
    }

    return isHomePlayer
      ? `${individualResult.HomeSetCount} - ${individualResult.AwaySetCount}`
      : `${individualResult.AwaySetCount} - ${individualResult.HomeSetCount}`;
  }

  /**
   * Updates victory statistics
   */
  private updateVictoryStats(
    individualResult: any,
    isHomePlayer: boolean,
    matchDate: string,
    victoryCount: number,
    defeatCount: number,
    lastVictory: Date | undefined,
    firstVictory: Date | undefined,
    lastDefeat: Date | undefined,
  ): {
    victoryCount: number;
    defeatCount: number;
    lastVictory?: Date;
    firstVictory?: Date;
    lastDefeat?: Date;
  } {
    const matchDateObj = new Date(matchDate);
    const isVictory = isHomePlayer
      ? individualResult.HomeSetCount > individualResult.AwaySetCount
      : individualResult.AwaySetCount > individualResult.HomeSetCount;

    if (isVictory) {
      victoryCount++;
      if (!lastVictory || matchDateObj > lastVictory) {
        lastVictory = matchDateObj;
      }
      if (!firstVictory || matchDateObj < firstVictory) {
        firstVictory = matchDateObj;
      }
    } else {
      defeatCount++;
      if (!lastDefeat || matchDateObj > lastDefeat) {
        lastDefeat = matchDateObj;
      }
    }

    return { victoryCount, defeatCount, lastVictory, firstVictory, lastDefeat };
  }
}
