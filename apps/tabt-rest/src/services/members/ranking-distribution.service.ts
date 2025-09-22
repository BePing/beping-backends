import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PlayerCategory } from '@prisma/client';
import { CacheService, TTL_DURATION } from '../../common/cache/cache.service';
import { PlayerCategoryDTO } from '../../common/dto/player-category.dto';
import { PrismaService } from '../../common/prisma.service';
import {
  MEN_RANKING_ESTIMATION,
  WOMAN_RANKING_ESTIMATION,
} from '../../common/consts/ranking-estimation';

interface MemberCountCache {
  [PlayerCategoryDTO.SENIOR_MEN]: number | null;
  [PlayerCategoryDTO.SENIOR_WOMEN]: number | null;
  lastUpdated: Date | null;
}

@Injectable()
export class RankingDistributionService
  implements OnModuleInit, OnModuleDestroy
{
  private memberCountCache: MemberCountCache = {
    [PlayerCategoryDTO.SENIOR_MEN]: null,
    [PlayerCategoryDTO.SENIOR_WOMEN]: null,
    lastUpdated: null,
  };

  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async onModuleInit() {
    // Initialize cache on startup
    await this.refreshMemberCounts();

    // Schedule daily refresh at midnight
    this.scheduleNextRefresh();
  }

  onModuleDestroy() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  }

  async getMembersWithRankingCount(
    category: PlayerCategoryDTO = PlayerCategoryDTO.SENIOR_MEN,
  ): Promise<number> {
    // Check if cache needs refresh (older than 1 day)
    const shouldRefresh =
      !this.memberCountCache.lastUpdated ||
      Date.now() - this.memberCountCache.lastUpdated.getTime() >
        24 * 60 * 60 * 1000;

    if (shouldRefresh || this.memberCountCache[category] === null) {
      await this.refreshMemberCounts();
    }

    return this.memberCountCache[category] ?? 14000; // Fallback to 14000 if still null
  }

  private async refreshMemberCounts(): Promise<void> {
    try {
      console.log('Refreshing member count cache...');

      // Get the latest date once
      const latestDate = (
        await this.prismaService.numericPoints.findFirst({
          orderBy: { date: 'desc' },
          select: { date: true },
        })
      )?.date;

      if (!latestDate) {
        console.warn('No numeric points found in database');
        return;
      }

      // Parallel fetch for both categories
      const [menCount, womenCount] = await Promise.all([
        this.prismaService.numericPoints.count({
          where: {
            member: { playerCategory: PlayerCategory.SENIOR_MEN },
            ranking: { not: null },
            date: { equals: latestDate },
          },
        }),
        this.prismaService.numericPoints.count({
          where: {
            member: { playerCategory: PlayerCategory.SENIOR_WOMEN },
            ranking: { not: null },
            date: { equals: latestDate },
          },
        }),
      ]);

      this.memberCountCache[PlayerCategoryDTO.SENIOR_MEN] = menCount;
      this.memberCountCache[PlayerCategoryDTO.SENIOR_WOMEN] = womenCount;
      this.memberCountCache.lastUpdated = new Date();

      console.log(
        `Member count cache refreshed: Men=${menCount}, Women=${womenCount}`,
      );
    } catch (error) {
      console.error('Failed to refresh member count cache:', error);
    }
  }

  private scheduleNextRefresh(): void {
    // Calculate milliseconds until next midnight
    const now = new Date();
    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();

    this.refreshTimer = setTimeout(async () => {
      await this.refreshMemberCounts();
      // Schedule next refresh (24 hours from now)
      this.refreshTimer = setInterval(
        () => this.refreshMemberCounts(),
        24 * 60 * 60 * 1000,
      );
    }, msUntilMidnight);

    console.log(
      `Next member count refresh scheduled in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`,
    );
  }

  getRankingTable(
    totalPlayers: number,
    category: PlayerCategoryDTO,
  ): Record<string, number> {
    // Get the estimation table based on category
    const estimationTable =
      category === PlayerCategoryDTO.SENIOR_MEN
        ? MEN_RANKING_ESTIMATION
        : WOMAN_RANKING_ESTIMATION;

    // Get all available player counts and find the highest one that's lower than or equal to totalPlayers
    const availableCounts = Object.keys(estimationTable)
      .map(Number)
      .sort((a, b) => b - a); // Sort in descending order

    const selectedCount =
      availableCounts.find((count) => count <= totalPlayers) || 14000;

    return estimationTable[selectedCount.toString()];
  }

  async getLetterRankingEstimationFromNumericPoints(
    ranking: number,
    category: PlayerCategoryDTO,
  ): Promise<string> {
    const totalPlayers = await this.getMembersWithRankingCount(category);
    const rankingTable = this.getRankingTable(totalPlayers, category);
    return (
      Object.entries(rankingTable).find(
        ([_, threshold]) => ranking <= threshold,
      )?.[0] || 'NC'
    );
  }
}
