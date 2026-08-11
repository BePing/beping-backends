import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/common';
import {
  ChallengeComputation,
  ChallengeMatch,
  ChallengeMatchPlayer,
  ComputedPlayerPoint,
  ComputedRanking,
} from './challenge-worker.types';
import { computeRankingChecksum } from './challenge-checksum';

interface PlayerAccumulator {
  uniqueIndex: number;
  name: string;
  clubIndex: string;
  points: ComputedPlayerPoint[];
}

interface PointRules {
  pointsPerWin: number;
  pointsForFour: number;
}

@Injectable()
export class ChallengeCalculatorService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(
    seasonId: string,
    championshipWeek: number,
  ): Promise<ChallengeComputation> {
    const season = await this.prisma.challengeSeason.findUniqueOrThrow({
      where: { id: seasonId },
      include: {
        challenge: { include: { secretReferences: true } },
        regions: { orderBy: { displayOrder: 'asc' } },
        clubs: { include: { region: true } },
        levels: { orderBy: { displayOrder: 'asc' } },
        divisions: { include: { level: true } },
        excludedPlayers: true,
        pointOverrides: { where: { week: { lte: championshipWeek } } },
        rules: true,
      },
    });
    const pointRules = this.readPointRules(season.rules);

    const clubByIndex = new Map(
      season.clubs.map((club) => [club.clubIndex, club]),
    );
    const excluded = new Set(
      season.excludedPlayers.map((player) => player.playerUniqueIndex),
    );
    const players = new Map<number, PlayerAccumulator>();
    const seenPlayerWeek = new Map<string, string>();

    for (const division of season.divisions) {
      const matches = await this.fetchMatches(
        season.season,
        division.divisionId,
        season.challenge.secretReferences,
      );
      for (const match of matches) {
        const week = Number.parseInt(match.weekName, 10);
        if (!Number.isSafeInteger(week) || week > championshipWeek) continue;
        if (match.divisionId !== division.divisionId) continue;
        this.consumeTeam(
          match,
          'home',
          week,
          players,
          seenPlayerWeek,
          excluded,
          clubByIndex,
          division.level.code,
          pointRules,
        );
        this.consumeTeam(
          match,
          'away',
          week,
          players,
          seenPlayerWeek,
          excluded,
          clubByIndex,
          division.level.code,
          pointRules,
        );
      }
    }

    for (const override of season.pointOverrides) {
      const player = players.get(override.playerUniqueIndex);
      if (!player) {
        throw new Error(
          `Point override references absent player ${override.playerUniqueIndex}`,
        );
      }
      const point = player.points.find((entry) => entry.week === override.week);
      if (!point) {
        throw new Error(
          `Point override references absent week ${override.week} for player ${override.playerUniqueIndex}`,
        );
      }
      point.victoryCount = override.victoryCount ?? point.victoryCount;
      point.forfeit = override.forfeit ?? point.forfeit;
      point.pointsWon = this.calculatePoints(
        point.victoryCount,
        point.forfeit,
        pointRules,
      );
    }

    const levelOrder = new Map(
      season.levels.map((level, index) => [level.code, index]),
    );
    const rankingsWithoutPositions: Omit<
      ComputedRanking,
      'position' | 'totalParticipants'
    >[] = [];

    for (const player of players.values()) {
      const club = clubByIndex.get(player.clubIndex);
      if (!club) throw new Error(`Club ${player.clubIndex} is not configured`);
      const levelCode = this.attributeLevel(player.points, levelOrder);
      const level = season.levels.find((entry) => entry.code === levelCode);
      if (!level) throw new Error(`Level ${levelCode} is not configured`);
      const attributedOrder = levelOrder.get(levelCode) ?? 0;
      const counted = player.points.filter(
        (point) =>
          (levelOrder.get(point.levelCode) ?? Infinity) <= attributedOrder,
      );
      const values = counted.map((point) => point.pointsWon);
      rankingsWithoutPositions.push({
        playerUniqueIndex: player.uniqueIndex,
        playerName: player.name,
        clubIndex: club.clubIndex,
        clubName: club.clubName ?? club.clubIndex,
        regionCode: club.region.code,
        regionLabel: club.region.label,
        levelCode: level.code,
        levelLabel: level.label,
        points: values.reduce((sum, value) => sum + value, 0),
        count5Pts: values.filter((value) => value === 5).length,
        count3Pts: values.filter((value) => value === 3).length,
        count2Pts: values.filter((value) => value === 2).length,
        count1Pts: values.filter((value) => value === 1).length,
        count0Pts: values.filter((value) => value === 0).length,
      });
    }

    const grouped = new Map<string, typeof rankingsWithoutPositions>();
    for (const ranking of rankingsWithoutPositions) {
      const key = `${ranking.regionCode}:${ranking.levelCode}`;
      grouped.set(key, [...(grouped.get(key) ?? []), ranking]);
    }
    const rankings: ComputedRanking[] = [];
    for (const group of grouped.values()) {
      group.sort(
        (a, b) =>
          b.points - a.points ||
          b.count5Pts - a.count5Pts ||
          b.count3Pts - a.count3Pts ||
          b.count2Pts - a.count2Pts ||
          b.count1Pts - a.count1Pts ||
          a.playerName.localeCompare(b.playerName, 'fr'),
      );
      rankings.push(
        ...group.map((ranking, index) => ({
          ...ranking,
          position: index + 1,
          totalParticipants: group.length,
        })),
      );
    }
    rankings.sort(
      (a, b) =>
        a.regionCode.localeCompare(b.regionCode) ||
        (levelOrder.get(a.levelCode) ?? 0) -
          (levelOrder.get(b.levelCode) ?? 0) ||
        a.position - b.position,
    );

    const points = [...players.values()]
      .flatMap((player) => player.points)
      .sort(
        (a, b) => a.playerUniqueIndex - b.playerUniqueIndex || a.week - b.week,
      );
    const regionSummaries = season.regions.map((region) => {
      const regionRankings = rankings.filter(
        (ranking) => ranking.regionCode === region.code,
      );
      return {
        regionCode: region.code,
        regionLabel: region.label,
        totalPlayers: regionRankings.length,
        playersByLevel: Object.fromEntries(
          season.levels.map((level) => [
            level.code,
            regionRankings.filter((ranking) => ranking.levelCode === level.code)
              .length,
          ]),
        ),
        clubs: [
          ...new Set(regionRankings.map((ranking) => ranking.clubName)),
        ].sort(),
      };
    });
    const checksum = computeRankingChecksum(rankings);
    return { points, rankings, regionSummaries, checksum };
  }

  private async fetchMatches(
    season: number,
    divisionId: number,
    secretReferences: Array<{ key: string; envVarName: string }>,
  ): Promise<ChallengeMatch[]> {
    const baseUrl =
      process.env.BEPING_API_BASE_URL ?? 'https://api-v2.beping.be';
    const url = new URL('/v1/matches', baseUrl);
    url.searchParams.set('divisionId', String(divisionId));
    url.searchParams.set('withDetails', 'true');
    const headers: Record<string, string> = {
      'X-Tabt-Season': String(season),
      'X-Tabt-Database': 'aftt',
      'X-Application-For': 'challenge-worker',
    };
    for (const reference of secretReferences) {
      const value = process.env[reference.envVarName];
      if (!value) continue;
      if (reference.key === 'TABT_ACCOUNT') headers['X-Tabt-Account'] = value;
      if (reference.key === 'TABT_PASSWORD') headers['X-Tabt-Password'] = value;
    }
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      throw new Error(
        `Beping matches API returned ${response.status} for division ${divisionId}`,
      );
    }
    return (await response.json()) as ChallengeMatch[];
  }

  private consumeTeam(
    match: ChallengeMatch,
    side: 'home' | 'away',
    week: number,
    players: Map<number, PlayerAccumulator>,
    seenPlayerWeek: Map<string, string>,
    excluded: Set<number>,
    clubByIndex: Map<string, unknown>,
    levelCode: string,
    pointRules: PointRules,
  ): void {
    if (!match.matchDetails?.detailsCreated) return;
    const clubIndex = side === 'home' ? match.homeClub : match.awayClub;
    if (!clubByIndex.has(clubIndex)) return;
    const teamPlayers =
      side === 'home'
        ? match.matchDetails.homePlayers?.players
        : match.matchDetails.awayPlayers?.players;
    for (const member of teamPlayers ?? []) {
      if (
        !Number.isSafeInteger(member.uniqueIndex) ||
        member.uniqueIndex <= 0
      ) {
        throw new Error(
          `Unnormalizable player identity in match ${match.matchId}`,
        );
      }
      if (excluded.has(member.uniqueIndex)) continue;
      const participationKey = `${member.uniqueIndex}:${week}`;
      const priorMatch = seenPlayerWeek.get(participationKey);
      if (priorMatch && priorMatch !== match.matchId) {
        throw new Error(
          `Player ${member.uniqueIndex} appears in two matches during week ${week}`,
        );
      }
      if (priorMatch) continue;
      seenPlayerWeek.set(participationKey, match.matchId);
      const player = players.get(member.uniqueIndex) ?? {
        uniqueIndex: member.uniqueIndex,
        name: `${member.lastName} ${member.firstName}`.trim(),
        clubIndex,
        points: [],
      };
      if (player.clubIndex !== clubIndex) {
        player.clubIndex = clubIndex;
      }
      const opposingForfeit =
        side === 'home' ? match.isAwayForfeited : match.isHomeForfeited;
      const victoryCount = opposingForfeit
        ? 0
        : this.countVictories(member, side, match);
      const forfeit = opposingForfeit
        ? 4
        : this.countIndividualForfeits(member, side, match);
      player.points.push({
        playerUniqueIndex: member.uniqueIndex,
        playerName: player.name,
        clubIndex,
        divisionId: match.divisionId,
        week,
        matchId: match.matchId,
        matchUniqueId: match.matchUniqueId,
        levelCode,
        victoryCount,
        forfeit,
        pointsWon: this.calculatePoints(victoryCount, forfeit, pointRules),
      });
      players.set(member.uniqueIndex, player);
    }
  }

  private countVictories(
    player: ChallengeMatchPlayer,
    side: 'home' | 'away',
    match: ChallengeMatch,
  ): number {
    return (match.matchDetails?.individualMatchResults ?? []).filter(
      (result) => {
        const involved =
          side === 'home'
            ? result.homePlayerUniqueIndex?.includes(player.uniqueIndex)
            : result.awayPlayerUniqueIndex?.includes(player.uniqueIndex);
        const won =
          side === 'home'
            ? result.homeSetCount > result.awaySetCount
            : result.awaySetCount > result.homeSetCount;
        return involved && won;
      },
    ).length;
  }

  private countIndividualForfeits(
    player: ChallengeMatchPlayer,
    side: 'home' | 'away',
    match: ChallengeMatch,
  ): number {
    const individualForfeits = (
      match.matchDetails?.individualMatchResults ?? []
    ).filter((result) => {
      const involved =
        side === 'home'
          ? result.homePlayerUniqueIndex?.includes(player.uniqueIndex)
          : result.awayPlayerUniqueIndex?.includes(player.uniqueIndex);
      const opponentForfeited =
        side === 'home' ? result.isAwayForfeited : result.isHomeForfeited;
      const playerForfeited =
        side === 'home' ? result.isHomeForfeited : result.isAwayForfeited;
      return involved && opponentForfeited && !playerForfeited;
    }).length;
    const opposingPlayers =
      side === 'home'
        ? match.matchDetails?.awayPlayers?.players
        : match.matchDetails?.homePlayers?.players;
    const opposingTeamForfeits = (opposingPlayers ?? []).filter(
      (opponent) => opponent.isForfeited,
    ).length;
    return Math.max(individualForfeits, opposingTeamForfeits);
  }

  private attributeLevel(
    points: ComputedPlayerPoint[],
    levelOrder: Map<string, number>,
  ): string {
    const groups = new Map<string, ComputedPlayerPoint[]>();
    for (const point of points) {
      groups.set(point.levelCode, [
        ...(groups.get(point.levelCode) ?? []),
        point,
      ]);
    }
    return [...groups.entries()].sort(
      ([levelA, pointsA], [levelB, pointsB]) =>
        pointsB.length - pointsA.length ||
        Math.min(...pointsA.map((point) => point.week)) -
          Math.min(...pointsB.map((point) => point.week)) ||
        (levelOrder.get(levelA) ?? 0) - (levelOrder.get(levelB) ?? 0),
    )[0][0];
  }

  private calculatePoints(
    victories: number,
    forfeits: number,
    rules: PointRules,
  ): number {
    const totalWins = victories + forfeits;
    return totalWins === 4
      ? rules.pointsForFour
      : totalWins * rules.pointsPerWin;
  }

  private readPointRules(
    rules: Array<{ key: string; value: unknown }>,
  ): PointRules {
    const configured = rules.find((rule) => rule.key === 'points')?.value as
      Partial<PointRules> | undefined;
    return {
      pointsPerWin: configured?.pointsPerWin ?? 1,
      pointsForFour: configured?.pointsForFour ?? 5,
    };
  }
}
