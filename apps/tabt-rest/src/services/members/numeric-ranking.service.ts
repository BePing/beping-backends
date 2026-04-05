import { Injectable } from '@nestjs/common';
import {
  CompetitionType,
  NumericPoints,
  PlayerCategory as pc,
  Prisma,
} from '@prisma/client';
import { format } from 'date-fns';
import { CacheService, TTL_DURATION } from '../../common/cache/cache.service';
import {
  COMPETITION_TYPE,
  NumericRankingDetailsV1,
  WeeklyNumericPointsV1,
} from '../../api/member/dto/member.dto';
import { PlayerCategory } from '../../entity/tabt-input.interface';
import { ConfigService } from '@nestjs/config';
import { PlayerCategoryDTO } from '../../common/dto/player-category.dto';
import { PrismaService } from '../../common/prisma.service';
import { BepingNotifierService } from '../notifications/beping-notifier.service';
import { RankingDistributionService } from './ranking-distribution.service';
import { ApiProperty } from '@nestjs/swagger';

export class WeeklyNumericRankingHistoryEntryV1 {
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'The numeric ranking value',
  })
  numericRanking: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Estimated letter ranking based on numeric points',
  })
  rankingLetterEstimation: string | null;

  @ApiProperty({ type: Number, description: 'Numeric points at this date' })
  numericPoints: number;

  @ApiProperty({ type: String, description: 'ISO date string of the ranking' })
  date: string;
}

export class WeeklyRankingV1Response {
  @ApiProperty({
    type: () => NumericRankingDetailsV1,
    isArray: true,
    description: 'Detailed history of matches and points changes',
  })
  perDateHistory: NumericRankingDetailsV1[];

  @ApiProperty({
    type: () => WeeklyNumericRankingHistoryEntryV1,
    isArray: true,
    description: 'Weekly numeric ranking history',
  })
  numericRankingHistory: WeeklyNumericRankingHistoryEntryV1[];
}

export type IndividualResultWithOpponent = Prisma.IndividualResultGetPayload<{
  include: {
    memberOpponent: true;
  };
}>;

const CACHE_KEYS = {
  weeklyRanking: (licence: number, category: PlayerCategoryDTO) =>
    `member:weekly-ranking:${licence}:${category}`,
  pointsHistory: (licence: number, category: PlayerCategoryDTO) =>
    `member:points-history:${licence}:${category}`,
  matchResults: (licence: number, category: PlayerCategoryDTO) =>
    `member:match-results:${licence}:${category}`,
};

@Injectable()
export class NumericRankingService {
  private readonly POINTS_PRECISION = 100; // For rounding to 2 decimal places

  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly bepingNotifierService: BepingNotifierService,
    private readonly rankingDistributionService: RankingDistributionService,
  ) {}

  async getWeeklyRankingV1(
    licence: number,
    category: PlayerCategoryDTO,
  ): Promise<WeeklyRankingV1Response> {
    return this.cacheService.getFromCacheOrGetAndCacheResult(
      CACHE_KEYS.weeklyRanking(licence, category),
      async () => {
        const [history, actualPoints] = await Promise.all([
          this.getResultsDetailsHistory(licence, category),
          this.getActualPoints(licence, category),
        ]);

        // Find the ranking letter for each points value (optimized single pass)
        const numericRankingHistory = actualPoints.map((p) => {
          const points = p?.points ?? 0;
          const rankingLetter = p?.rankingLetterEstimation ?? '-';
          return {
            numericRanking: p.rankingWI,
            rankingLetterEstimation: rankingLetter,
            numericPoints: points,
            date: p.date.toISOString(),
          };
        });

        return {
          perDateHistory: history,
          numericRankingHistory,
        };
      },
      TTL_DURATION.ONE_DAY,
    );
  }

  async getActualPoints(
    licence: number,
    category: PlayerCategoryDTO,
  ): Promise<NumericPoints[]> {
    return this.cacheService.getFromCacheOrGetAndCacheResult(
      CACHE_KEYS.pointsHistory(licence, category),
      async () => {
        const gender =
          category === PlayerCategoryDTO.SENIOR_MEN
            ? pc.SENIOR_MEN
            : pc.SENIOR_WOMEN;
        const points = await this.prismaService.numericPoints.findMany({
          where: {
            memberLicence: licence,
            member: {
              playerCategory: gender,
            },
          },
          orderBy: {
            date: 'asc',
          },
        });

        return points.map((point) => ({
          ...point,
          date: new Date(point.date),
        }));
      },
      TTL_DURATION.ONE_HOUR,
    );
  }

  async getResultsDetailsHistory(
    licence: number,
    category: PlayerCategoryDTO,
  ): Promise<NumericRankingDetailsV1[]> {
    return this.cacheService.getFromCacheOrGetAndCacheResult(
      CACHE_KEYS.matchResults(licence, category),
      async () => {
        const gender =
          category === PlayerCategoryDTO.SENIOR_MEN
            ? pc.SENIOR_MEN
            : pc.SENIOR_WOMEN;

        // Optimize query by selecting only needed fields and including related data
        const results = await this.prismaService.individualResult.findMany({
          where: {
            memberLicence: licence,
            member: {
              playerCategory: gender,
            },
          },
          select: {
            date: true,
            competitionId: true,
            memberPoints: true,
            definitivePointsToAdd: true,
            score: true,
            opponentRanking: true,
            opponentLicence: true,
            opponentPoints: true,
            memberOpponent: {
              select: {
                firstname: true,
                lastname: true,
              },
            },
            competition: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
          orderBy: {
            date: 'asc',
          },
        });

        // Pre-process results into a Map for faster lookups
        const eventMap = new Map<string, (typeof results)[0][]>();

        for (const result of results) {
          const key = `${format(result.date, 'yyyy-MM-dd')}-${result.competitionId}`;
          if (!eventMap.has(key)) {
            eventMap.set(key, []);
          }
          eventMap.get(key)!.push(result);
        }

        const eventGroupedArray: NumericRankingDetailsV1[] = [];
        let basePoints = results[0]?.memberPoints?.toNumber() ?? 0;

        // Process events in chronological order
        for (const [key, events] of Array.from(eventMap.entries()).sort()) {
          const firstEvent = events[0];
          const competitionType =
            firstEvent.competition.type === CompetitionType.TOURNAMENT
              ? COMPETITION_TYPE.TOURNAMENT
              : COMPETITION_TYPE.CHAMPIONSHIP;

          const opponents = events.map((result) => ({
            opponentName: `${result.memberOpponent.firstname} ${result.memberOpponent.lastname}`,
            opponentRanking: result.opponentRanking,
            opponentUniqueIndex: result.opponentLicence,
            opponentNumericPoints: result.opponentPoints?.toNumber() ?? 0,
            pointsWon: result.definitivePointsToAdd.toNumber(),
            score: result.score,
          }));

          const endPoints = events.reduce(
            (acc, result) => acc + result.definitivePointsToAdd.toNumber(),
            basePoints,
          );

          eventGroupedArray.push({
            date: format(firstEvent.date, 'yyyy-MM-dd'),
            competitionContext: firstEvent.competitionId,
            competitionType,
            basePoints:
              Math.round(basePoints * this.POINTS_PRECISION) /
              this.POINTS_PRECISION,
            endPoints:
              Math.round(endPoints * this.POINTS_PRECISION) /
              this.POINTS_PRECISION,
            opponents,
          });

          basePoints = endPoints;
        }

        return eventGroupedArray.reverse();
      },
      TTL_DURATION.ONE_DAY,
    );
  }
}
