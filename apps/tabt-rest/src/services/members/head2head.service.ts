import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

import { MatchService } from '../matches/match.service';
import { TeamMatchesEntry } from '../../entity/tabt-soap/TabTAPI_Port';
import { CacheService, TTL_DURATION } from '@app/common';
import { SocksProxyHttpClient } from '../../common/socks-proxy/socks-proxy-http-client';
import { UserAgentsUtil } from '../../common/utils/user-agents.util';

// Constants
const AFTT_BASE_URL = 'https://resultats.aftt.be/index.php';
const CACHE_PREFIX = 'head2head';

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

  @ApiPropertyOptional()
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
    const cacheKey = `${CACHE_PREFIX}:${playerUniqueIndex}-${opponentPlayerUniqueIndex}:${new Date().toISOString()}`;

    const getter = async (): Promise<Head2HeadData> => {
      try {
        this.logger.debug(
          `Getting head-to-head results for players ${playerUniqueIndex} vs ${opponentPlayerUniqueIndex}`,
        );
        const htmlPage = await this.getPageFromAFTT(
          playerUniqueIndex,
          opponentPlayerUniqueIndex,
        );
        this.logger.debug('HTML page fetched, extracting data...');

        const matchesExtracted = this.extractMatchesInfos(htmlPage);
        this.logger.debug(
          `Extracted ${matchesExtracted.length} matches from HTML`,
        );

        const playersInfo = this.extractPlayerNames(htmlPage);
        this.logger.debug('Player information extracted');

        if (matchesExtracted.length === 0) {
          this.logger.warn(
            'No matches extracted from HTML, returning empty head-to-head data',
          );
          return this.createEmptyHead2HeadData(playersInfo);
        }

        this.logger.debug(
          `Fetching details for ${matchesExtracted.length} matches`,
        );
        const matchesFound = await Promise.all(
          matchesExtracted.map((m) => this.getMatchDetails(m)),
        );

        const teamMatchEntries = matchesFound.filter(
          (match): match is TeamMatchesEntry => !!match,
        );

        this.logger.debug(
          `Found ${teamMatchEntries.length} valid match entries out of ${matchesFound.length} attempts`,
        );

        if (teamMatchEntries.length === 0) {
          this.logger.warn(
            'No valid match entries found, returning empty head-to-head data',
          );
          return this.createEmptyHead2HeadData(playersInfo);
        }

        const result = this.calculateHead2Head(
          teamMatchEntries,
          matchesExtracted,
          playersInfo,
        );
        this.logger.debug(
          `Head-to-head calculation complete: ${result.head2HeadCount} matches, ${result.victoryCount} victories, ${result.defeatCount} defeats`,
        );
        return result;
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
      const url = `${AFTT_BASE_URL}?menu=4&head=1&player_1=${playerA}&player_2=${playerB}`;
      this.logger.debug(`Fetching AFTT page from ${url}`);
      const result = await firstValueFrom(
        this.httpService.post(
          url,
          {
            responseType: 'text',
            maxRedirects: 0,
          },
          {
            headers: {
              'user-agent': UserAgentsUtil.random,
            },
          },
        ),
      );
      const htmlLength = result.data?.length || 0;
      this.logger.debug(
        `Fetched AFTT page: ${htmlLength} characters, first 500 chars: ${result.data?.substring(0, 500)}`,
      );
      // Log a sample of the HTML around potential match links
      const matchLinkSample = result.data?.match(
        /<A[^>]*href="[^"]*season=[^"]*"[^>]*>.*?<\/A>/i,
      );
      if (matchLinkSample) {
        this.logger.debug(`Sample match link found: ${matchLinkSample[0]}`);
      } else {
        this.logger.warn('No match link pattern found in HTML');
      }
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
    this.logger.debug(
      `Extracting match info from HTML (length: ${htmlPage.length})`,
    );

    // Match pattern: href with season, week_name, div_id and link text containing match ID
    // Example: href="...?menu=4&season=26&sel=1&detail=1&week_name=04&div_id=8866">PBBWH04/036</A>
    // Also handles full URLs: href="https://resultats.aftt.be/?menu=4&season=16&..."
    const regex =
      /season=(\d+)[^>]*&week_name=(\d+)[^>]*&div_id=(\d+)[^>]*">([^<]+)<\/A>/gim;
    this.logger.debug(`Using regex pattern: ${regex.toString()}`);

    const matches: ExtractedMatchInfo[] = [];
    let matchCount = 0;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(htmlPage)) !== null) {
      matchCount++;
      this.logger.debug(
        `Regex match ${matchCount} found: season=${match[1]}, week_name=${match[2]}, div_id=${match[3]}, linkText="${match[4]}"`,
      );

      const season = Number(match[1]);
      const weekName = match[2];
      const divisionId = Number(match[3]);
      const linkText = match[4].trim();

      // Extract match ID from link text (format: PREFIXWEEK/MATCH or WEEK/MATCH)
      // Examples: "PBBWH20/045" -> "20/045", "PBBWH04/036" -> "04/036"
      // The match ID format is typically WEEK/MATCHNUMBER
      const matchIdMatch = linkText.match(/(\d{1,2})\/(\d+)/);
      if (matchIdMatch) {
        // Use the week from the URL to ensure consistency, but extract match number from link text
        const matchNumber = matchIdMatch[2];
        // Match ID format: weekName/matchNumber (e.g., "04/036" or "20/045")
        const matchId = `${weekName}/${matchNumber}`;
        this.logger.debug(
          `Extracted match ID: ${matchId} from linkText: "${linkText}"`,
        );
        matches.push({
          matchId,
          weekName,
          divisionId,
          season,
        });
      } else {
        this.logger.warn(
          `Could not extract match ID from linkText: "${linkText}"`,
        );
      }
    }

    this.logger.debug(
      `Extracted ${matches.length} matches from ${matchCount} regex matches`,
    );

    // If no matches found, try alternative patterns and log samples
    if (matches.length === 0) {
      this.logger.warn('No matches extracted. Trying alternative patterns...');

      // Try a more flexible pattern that doesn't require exact order
      const flexiblePattern =
        /<A[^>]*href="[^"]*season=(\d+)[^"]*"[^>]*>([^<]+)<\/A>/gi;
      const flexibleMatches = htmlPage.matchAll(flexiblePattern);
      let flexibleCount = 0;
      for (const flexMatch of flexibleMatches) {
        flexibleCount++;
        if (flexibleCount <= 3) {
          this.logger.debug(
            `Flexible pattern match ${flexibleCount}: season=${flexMatch[1]}, linkText="${flexMatch[2]}"`,
          );
        }
      }
      this.logger.debug(
        `Found ${flexibleCount} links with season parameter using flexible pattern`,
      );

      // Try to find any links with season parameter
      const seasonLinks = htmlPage.match(/href="[^"]*season=\d+[^"]*"/gi);
      if (seasonLinks && seasonLinks.length > 0) {
        this.logger.debug(
          `Found ${seasonLinks.length} links with season parameter. Sample: ${seasonLinks[0]}`,
        );
      }
      // Try to find any A tags with href containing week_name
      const weekLinks = htmlPage.match(
        /<A[^>]*href="[^"]*week_name=[^"]*"[^>]*>.*?<\/A>/gi,
      );
      if (weekLinks && weekLinks.length > 0) {
        this.logger.debug(
          `Found ${weekLinks.length} links with week_name. Sample: ${weekLinks[0]?.substring(0, 200)}`,
        );
      }
      // Try to find table rows with match data
      const tableRows = htmlPage.match(
        /<tr[^>]*class="DBTable"[^>]*>[\s\S]{0,500}?<\/tr>/gi,
      );
      if (tableRows && tableRows.length > 0) {
        this.logger.debug(
          `Found ${tableRows.length} DBTable rows. Sample row: ${tableRows[1]?.substring(0, 300)}`,
        );
      }
    }

    return matches;
  }

  /**
   * Extracts player names and unique indexes from the AFTT HTML page
   */
  private extractPlayerNames(htmlPage: string): PlayersInfo {
    this.logger.debug('Extracting player names from HTML');

    // Match pattern: <INPUT ... id="player_1" name="player_1" value="130573/BAUDOUIN LOOS">
    const regex =
      /id="player_([12])"[^>]*name="player_\1"[^>]*value="([0-9]+)\/([^"]+)"/gm;
    this.logger.debug(`Using regex pattern: ${regex.toString()}`);

    const players: Array<[string, string]> = [];
    let matchCount = 0;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(htmlPage)) !== null) {
      matchCount++;
      const playerIndex = Number(match[1]);
      const uniqueIndex = match[2];
      const name = match[3].trim();
      this.logger.debug(
        `Found player ${playerIndex}: uniqueIndex=${uniqueIndex}, name="${name}"`,
      );
      players[playerIndex - 1] = [uniqueIndex, name];
    }

    this.logger.debug(`Extracted ${matchCount} player matches`);

    if (players.length !== 2 || !players[0] || !players[1]) {
      this.logger.error(
        `Failed to extract player information. Found ${players.length} players: ${JSON.stringify(players)}`,
      );
      // Try alternative patterns
      const altPattern1 = htmlPage.match(/id="player_1"[^>]*value="([^"]+)"/i);
      const altPattern2 = htmlPage.match(/id="player_2"[^>]*value="([^"]+)"/i);
      if (altPattern1) {
        this.logger.debug(
          `Alternative pattern found player_1: ${altPattern1[1]}`,
        );
      }
      if (altPattern2) {
        this.logger.debug(
          `Alternative pattern found player_2: ${altPattern2[1]}`,
        );
      }
      throw new Error('Failed to extract player information');
    }

    const result = {
      playerName: players[0][1],
      playerUniqueIndex: Number(players[0][0]),
      opponentPlayerName: players[1][1],
      opponentPlayerUniqueIndex: Number(players[1][0]),
    };
    this.logger.debug(
      `Successfully extracted players: ${result.playerName} (${result.playerUniqueIndex}) vs ${result.opponentPlayerName} (${result.opponentPlayerUniqueIndex})`,
    );

    return result;
  }

  /**
   * Retrieves detailed match information
   */
  private async getMatchDetails(
    matchExtracted: ExtractedMatchInfo,
  ): Promise<TeamMatchesEntry | undefined> {
    try {
      this.logger.debug(
        `Getting match details for: season=${matchExtracted.season}, divisionId=${matchExtracted.divisionId}, weekName=${matchExtracted.weekName}, matchId=${matchExtracted.matchId}`,
      );

      // WeekName should be a string according to GetMatchesInput interface
      const weekNameStr = String(matchExtracted.weekName);

      const queryParams = {
        DivisionId: matchExtracted.divisionId,
        Season: matchExtracted.season,
        WeekName: weekNameStr,
        WithDetails: true,
        // MatchId: matchExtracted.matchId, // Also try filtering by MatchId directly
      };
      this.logger.debug(
        `Querying matches with params: ${JSON.stringify(queryParams)}`,
      );

      const matches = await this.matchService.getMatches(queryParams);

      this.logger.debug(
        `Found ${matches.length} matches for the query. Looking for matchId: ${matchExtracted.matchId}`,
      );

      // find a MatchId that contains the matchExtracted.matchId
      const foundMatch = matches.find((match) =>
        match.MatchId.includes(matchExtracted.matchId),
      );

      if (!foundMatch) {
        this.logger.warn(
          `Match not found. Looking for matchId: "${matchExtracted.matchId}", but available matches have IDs: ${matches.map((m) => `"${m.MatchId}"`).join(', ') || 'none'}`,
        );
      }

      if (foundMatch) {
        this.logger.debug(
          `Found match: ${foundMatch.MatchId} for extracted matchId: ${matchExtracted.matchId}`,
        );
      } else {
        this.logger.warn(
          `Match not found. Looking for matchId: "${matchExtracted.matchId}", but available matches have IDs: ${matches.map((m) => `"${m.MatchId}"`).join(', ') || 'none'}`,
        );
      }

      return foundMatch;
    } catch (error) {
      this.logger.error(
        `Failed to get match details for matchId=${matchExtracted.matchId}: ${error.message}`,
        error.stack,
      );
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
    this.logger.debug(
      `Calculating head-to-head for ${teamMatchEntries.length} matches`,
    );
    const head2HeadCount = teamMatchEntries.length;
    let victoryCount = 0;
    let defeatCount = 0;
    let lastVictory: Date | undefined;
    let firstVictory: Date | undefined;
    let lastDefeat: Date | undefined;
    const matchEntryHistory: MatchEntryHistory[] = [];

    for (const match of teamMatchEntries) {
      this.logger.debug(
        `Processing match: MatchId=${match.MatchId}, Date=${match.Date}`,
      );

      // Match using includes since MatchId from API might have prefix (e.g., "PBBWH04/036" vs "04/036")
      const linkedExtractedMatch = extractedMatches.find(
        (m) =>
          match.MatchId.includes(m.matchId) ||
          m.matchId.includes(match.MatchId),
      );

      if (!linkedExtractedMatch) {
        this.logger.warn(
          `No linked extracted match found for MatchId: ${match.MatchId}. Available extracted matchIds: ${extractedMatches.map((m) => m.matchId).join(', ')}`,
        );
        continue;
      }

      this.logger.debug(
        `Found linked match: extracted matchId=${linkedExtractedMatch.matchId}, API MatchId=${match.MatchId}`,
      );

      const isHomePlayer =
        match.MatchDetails?.HomePlayers?.Players?.some(
          (p) => p.UniqueIndex === playersInfo.playerUniqueIndex,
        ) ?? false;

      this.logger.debug(
        `Player ${playersInfo.playerUniqueIndex} is ${isHomePlayer ? 'home' : 'away'}`,
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

      if (!player) {
        this.logger.warn(
          `Player ${playersInfo.playerUniqueIndex} not found in match ${match.MatchId}`,
        );
        continue;
      }
      if (!opponent) {
        this.logger.warn(
          `Opponent ${playersInfo.opponentPlayerUniqueIndex} not found in match ${match.MatchId}`,
        );
        continue;
      }

      this.logger.debug(
        `Found player: ${player.FirstName} ${player.LastName} (${player.Ranking}) vs opponent: ${opponent.FirstName} ${opponent.LastName} (${opponent.Ranking})`,
      );

      const individualResult = this.findIndividualResult(
        match,
        playersInfo,
        isHomePlayer,
      );

      if (!individualResult) {
        this.logger.warn(
          `No individual result found for match ${match.MatchId} between players ${playersInfo.playerUniqueIndex} and ${playersInfo.opponentPlayerUniqueIndex}`,
        );
        // Still add to history even without individual result
        matchEntryHistory.push({
          season: linkedExtractedMatch.season,
          date: new Date(match.Date),
          matchEntry: match,
          playerRanking: player.Ranking,
          opponentRanking: opponent.Ranking,
          score: undefined,
        });
        continue;
      }

      // Check if match is forfeited
      if (
        individualResult.IsHomeForfeited ||
        individualResult.IsAwayForfeited
      ) {
        this.logger.debug(
          `Match is forfeited: IsHomeForfeited=${individualResult.IsHomeForfeited}, IsAwayForfeited=${individualResult.IsAwayForfeited}`,
        );
        // Still add to history but without score
        matchEntryHistory.push({
          season: linkedExtractedMatch.season,
          date: new Date(match.Date),
          matchEntry: match,
          playerRanking: player.Ranking,
          opponentRanking: opponent.Ranking,
          score: 'Forfait',
        });
        continue;
      }

      this.logger.debug(
        `Found individual result: HomeSetCount=${individualResult.HomeSetCount}, AwaySetCount=${individualResult.AwaySetCount}, HomePlayerUniqueIndex=${JSON.stringify(individualResult.HomePlayerUniqueIndex)}, AwayPlayerUniqueIndex=${JSON.stringify(individualResult.AwayPlayerUniqueIndex)}, IsHomeForfeited=${individualResult.IsHomeForfeited}, IsAwayForfeited=${individualResult.IsAwayForfeited}`,
      );

      const score = this.calculateScore(individualResult, isHomePlayer);

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

      this.logger.debug(
        `Updated stats: victories=${victoryCount}, defeats=${defeatCount}, score=${score}`,
      );

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
    if (!match.MatchDetails?.IndividualMatchResults) {
      this.logger.warn(
        `No IndividualMatchResults found in match ${match.MatchId}`,
      );
      return undefined;
    }

    this.logger.debug(
      `Searching for individual result: player=${playersInfo.playerUniqueIndex}, opponent=${playersInfo.opponentPlayerUniqueIndex}, isHomePlayer=${isHomePlayer}. Total individual results: ${match.MatchDetails.IndividualMatchResults.length}`,
    );

    const result = match.MatchDetails.IndividualMatchResults.find(
      (individualMatch) => {
        const homePlayerMatch = Array.isArray(
          individualMatch.HomePlayerUniqueIndex,
        )
          ? individualMatch.HomePlayerUniqueIndex.includes(
              playersInfo.playerUniqueIndex,
            )
          : individualMatch.HomePlayerUniqueIndex ===
            playersInfo.playerUniqueIndex;
        const awayPlayerMatch = Array.isArray(
          individualMatch.AwayPlayerUniqueIndex,
        )
          ? individualMatch.AwayPlayerUniqueIndex.includes(
              playersInfo.opponentPlayerUniqueIndex,
            )
          : individualMatch.AwayPlayerUniqueIndex ===
            playersInfo.opponentPlayerUniqueIndex;

        if (isHomePlayer) {
          return homePlayerMatch && awayPlayerMatch;
        } else {
          const awayPlayerMatch2 = Array.isArray(
            individualMatch.AwayPlayerUniqueIndex,
          )
            ? individualMatch.AwayPlayerUniqueIndex.includes(
                playersInfo.playerUniqueIndex,
              )
            : individualMatch.AwayPlayerUniqueIndex ===
              playersInfo.playerUniqueIndex;
          const homePlayerMatch2 = Array.isArray(
            individualMatch.HomePlayerUniqueIndex,
          )
            ? individualMatch.HomePlayerUniqueIndex.includes(
                playersInfo.opponentPlayerUniqueIndex,
              )
            : individualMatch.HomePlayerUniqueIndex ===
              playersInfo.opponentPlayerUniqueIndex;
          return awayPlayerMatch2 && homePlayerMatch2;
        }
      },
    );

    if (!result) {
      this.logger.warn(
        `Individual result not found. Available individual matches: ${match.MatchDetails.IndividualMatchResults.map(
          (im) =>
            `Home=${JSON.stringify(im.HomePlayerUniqueIndex)}, Away=${JSON.stringify(im.AwayPlayerUniqueIndex)}`,
        ).join('; ')}`,
      );
    }

    return result;
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

    // Handle null, undefined, or NaN values
    const homeSetCount =
      individualResult.HomeSetCount != null &&
      !isNaN(individualResult.HomeSetCount)
        ? individualResult.HomeSetCount
        : null;
    const awaySetCount =
      individualResult.AwaySetCount != null &&
      !isNaN(individualResult.AwaySetCount)
        ? individualResult.AwaySetCount
        : null;

    if (homeSetCount === null || awaySetCount === null) {
      this.logger.warn(
        `Cannot calculate score: HomeSetCount=${individualResult.HomeSetCount} (parsed: ${homeSetCount}), AwaySetCount=${individualResult.AwaySetCount} (parsed: ${awaySetCount})`,
      );
      return undefined;
    }

    return isHomePlayer
      ? `${homeSetCount} - ${awaySetCount}`
      : `${awaySetCount} - ${homeSetCount}`;
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

    // Handle null, undefined, or NaN values
    const homeSetCount =
      individualResult.HomeSetCount != null &&
      !isNaN(individualResult.HomeSetCount)
        ? Number(individualResult.HomeSetCount)
        : null;
    const awaySetCount =
      individualResult.AwaySetCount != null &&
      !isNaN(individualResult.AwaySetCount)
        ? Number(individualResult.AwaySetCount)
        : null;

    // If set counts are null, we can't determine victory/defeat
    if (homeSetCount === null || awaySetCount === null) {
      this.logger.warn(
        `Cannot determine victory/defeat: HomeSetCount=${individualResult.HomeSetCount} (parsed: ${homeSetCount}), AwaySetCount=${individualResult.AwaySetCount} (parsed: ${awaySetCount})`,
      );
      return {
        victoryCount,
        defeatCount,
        lastVictory,
        firstVictory,
        lastDefeat,
      };
    }

    const playerSetCount = isHomePlayer ? homeSetCount : awaySetCount;
    const opponentSetCount = isHomePlayer ? awaySetCount : homeSetCount;

    if (playerSetCount > opponentSetCount) {
      // Victory
      victoryCount++;
      if (!lastVictory || matchDateObj > lastVictory) {
        lastVictory = matchDateObj;
      }
      if (!firstVictory || matchDateObj < firstVictory) {
        firstVictory = matchDateObj;
      }
      this.logger.debug(
        `Victory detected: Player won ${playerSetCount}-${opponentSetCount}`,
      );
    } else if (playerSetCount < opponentSetCount) {
      // Defeat
      defeatCount++;
      if (!lastDefeat || matchDateObj > lastDefeat) {
        lastDefeat = matchDateObj;
      }
      this.logger.debug(
        `Defeat detected: Player lost ${playerSetCount}-${opponentSetCount}`,
      );
    } else {
      // Tie (shouldn't happen in table tennis, but handle gracefully)
      this.logger.warn(
        `Tie detected: ${playerSetCount}-${opponentSetCount}. This shouldn't happen in table tennis individual matches.`,
      );
      // Don't count as victory or defeat
    }

    return { victoryCount, defeatCount, lastVictory, firstVictory, lastDefeat };
  }
}
