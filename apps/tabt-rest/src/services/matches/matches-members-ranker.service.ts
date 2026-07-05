import { Injectable } from '@nestjs/common';
import { Player, TeamMatchesEntry } from '../../entity/tabt-soap/TabTAPI_Port';
import { MatchService } from './match.service';
import { CacheService, TTL_DURATION } from '@app/common';
import { ContextService } from '../../common/context/context.service';
import { ApiProperty } from '@nestjs/swagger';

export enum SortSystem {
  MOST_PLAYED = 'MOST_PLAYED',
  BEST_PERF_PER_PCT = 'BEST_PERF_PER_PCT',
  BEST_PERF_PER_WIN = 'BEST_PERF_PER_WIN',
}
export class PlayerMatchStats {
  @ApiProperty()
  played: number;
  @ApiProperty()
  win: number;
  @ApiProperty()
  lose: number;
  @ApiProperty()
  uniqueIndex: number;
  @ApiProperty()
  firstName: string;
  @ApiProperty()
  lastName: string;
  @ApiProperty()
  ranking: string;
  @ApiProperty()
  winPourcentage: number;
  @ApiProperty()
  losePourcentage: number;
  @ApiProperty()
  club: string;
}

interface PlayerStats extends Omit<
  PlayerMatchStats,
  'winPourcentage' | 'losePourcentage'
> {
  uniqueIndex: number;
  firstName: string;
  lastName: string;
  ranking: string;
  played: number;
  win: number;
  lose: number;
}

type SortFunction = (a: PlayerMatchStats, b: PlayerMatchStats) => number;

@Injectable()
export class MatchesMembersRankerService {
  private static readonly SORT_FUNCTIONS: Record<SortSystem, SortFunction> = {
    [SortSystem.MOST_PLAYED]: (a, b) =>
      b.played * 100 + b.winPourcentage - (a.played * 100 + a.winPourcentage),
    [SortSystem.BEST_PERF_PER_PCT]: (a, b) =>
      b.winPourcentage * 100 + b.played - (a.winPourcentage * 100 + a.played),
    [SortSystem.BEST_PERF_PER_WIN]: (a, b) => b.win - a.win,
  };

  constructor(
    private readonly matchService: MatchService,
    private readonly cacheService: CacheService,
    private readonly contextService: ContextService,
  ) {}

  async getMembersRankingFromDivision(
    divisionId: number,
    sortingSystem: SortSystem = SortSystem.BEST_PERF_PER_WIN,
  ): Promise<PlayerMatchStats[]> {
    const cacheKey = `members-ranking-division:${this.contextService.context.runner.season}:${divisionId}`;
    return this.cacheService.getFromCacheOrGetAndCacheResult(
      cacheKey,
      () =>
        this.fetchAndComputeRanking(
          { DivisionId: divisionId, WithDetails: true },
          sortingSystem,
        ),
      TTL_DURATION.EIGHT_HOURS,
    );
  }

  async getMembersRankingFromClub(
    club: string,
    season: number,
    sortingSystem: SortSystem = SortSystem.BEST_PERF_PER_PCT,
  ): Promise<PlayerMatchStats[]> {
    const cacheKey = `members-ranking-club:${season}:${club}`;
    return this.cacheService.getFromCacheOrGetAndCacheResult(
      cacheKey,
      () =>
        this.fetchAndComputeRanking(
          { Season: season, Club: club, WithDetails: true },
          sortingSystem,
          club,
        ),
      TTL_DURATION.EIGHT_HOURS,
    );
  }

  async getMembersRankingFromTeam(
    club: string,
    teamId: string,
    season: number,
    sortingSystem: SortSystem = SortSystem.MOST_PLAYED,
  ): Promise<PlayerMatchStats[]> {
    const [divisionId] = teamId.split('-');
    const cacheKey = `members-ranking-team:${season}:${club}-${teamId}`;
    return this.cacheService.getFromCacheOrGetAndCacheResult(
      cacheKey,
      () =>
        this.fetchAndComputeRanking(
          {
            Season: season,
            Club: club,
            DivisionId: Number(divisionId),
            WithDetails: true,
          },
          sortingSystem,
          club,
        ),
      TTL_DURATION.EIGHT_HOURS,
    );
  }

  private async fetchAndComputeRanking(
    matchParams: Record<string, any>,
    sortingSystem: SortSystem,
    keepClub?: string,
  ): Promise<PlayerMatchStats[]> {
    const matches = await this.matchService.getMatches(matchParams);
    return this.computeRanking(matches, sortingSystem, keepClub);
  }

  private computeRanking(
    matches: TeamMatchesEntry[],
    sortingSystem: SortSystem,
    keepClub?: string,
  ): PlayerMatchStats[] {
    const players = new Map<number, PlayerStats>();

    for (const match of matches) {
      if (!match.MatchDetails?.DetailsCreated) continue;

      const { MatchDetails: matchDetails, HomeClub, AwayClub } = match;
      const shouldIncludeHome = !keepClub || HomeClub === keepClub;
      const shouldIncludeAway = !keepClub || AwayClub === keepClub;

      const matchPlayers = [
        ...(shouldIncludeHome
          ? this.mapPlayers(matchDetails.HomePlayers?.Players, HomeClub)
          : []),
        ...(shouldIncludeAway
          ? this.mapPlayers(matchDetails.AwayPlayers?.Players, AwayClub)
          : []),
      ];

      this.processMatchPlayers(matchPlayers, players, matchDetails);
    }

    return this.computePctAndSort([...players.values()], sortingSystem);
  }

  private mapPlayers(players: Player[] = [], club: string): PlayerStats[] {
    return players.map((p) => ({
      uniqueIndex: p.UniqueIndex,
      firstName: p.FirstName,
      lastName: p.LastName,
      ranking: p.Ranking,
      played: 0,
      win: 0,
      lose: 0,
      club,
    }));
  }

  private processMatchPlayers(
    matchPlayers: PlayerStats[],
    players: Map<number, PlayerStats>,
    matchDetails: any,
  ): void {
    for (const player of matchPlayers) {
      const playerEntry = players.get(player.uniqueIndex) ?? { ...player };

      for (const match of matchDetails.IndividualMatchResults) {
        if (!match || match.IsHomeForfeited || match.IsAwayForfeited) continue;

        const isHomePlayer = match.HomePlayerUniqueIndex?.includes(
          player.uniqueIndex,
        );
        const isAwayPlayer = match.AwayPlayerUniqueIndex?.includes(
          player.uniqueIndex,
        );

        if (!isHomePlayer && !isAwayPlayer) continue;

        playerEntry.played++;

        const playerWon =
          (isHomePlayer && match.HomeSetCount > match.AwaySetCount) ||
          (isAwayPlayer && match.AwaySetCount > match.HomeSetCount);

        if (playerWon) {
          playerEntry.win++;
        } else {
          playerEntry.lose++;
        }
      }

      players.set(player.uniqueIndex, playerEntry);
    }
  }

  private computePctAndSort(
    members: PlayerStats[],
    sortSystem: SortSystem,
  ): PlayerMatchStats[] {
    const results = members
      .filter((member) => member.played > 0)
      .map((member) => ({
        ...member,
        winPourcentage: Math.round((member.win / member.played) * 100),
        losePourcentage: Math.round((member.lose / member.played) * 100),
      }));

    return results.sort(MatchesMembersRankerService.SORT_FUNCTIONS[sortSystem]);
  }
}
