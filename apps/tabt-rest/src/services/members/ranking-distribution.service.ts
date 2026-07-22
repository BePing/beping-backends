import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PlayerCategoryDTO } from '../../common/dto/player-category.dto';
import { PrismaService } from '@app/common';
import { estimateLetterRanking, getRankingEstimationTable } from '@app/common';

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

  constructor(private readonly prismaService: PrismaService) {}

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

      // Count members having at least 10 individual results OR ranking starting with 'A' (excluding 'As')
      const [menCount, womenCount] = await Promise.all([
        this.prismaService.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::int as count
          FROM (
            SELECT 
              m.id,
              m.licence,
              m.firstname,
              m.lastname,
              m.ranking,
              m.club,
              COUNT(ir.id) as total_results
            FROM "Member" m
            LEFT JOIN "IndividualResult" ir 
              ON m.id = ir."memberId" 
              AND m.licence = ir."memberLicence"
            WHERE m."playerCategory" = 'SENIOR_MEN'
            GROUP BY m.id, m.licence, m.firstname, m.lastname, m.ranking, m.club
            HAVING COUNT(ir.id) >= 10 OR (m.ranking LIKE 'A%' AND m.ranking NOT LIKE 'As%')
          ) filtered_members
        `.then((result) => Number(result[0].count)),
        this.prismaService.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::int as count
          FROM (
            SELECT 
              m.id,
              m.licence,
              m.firstname,
              m.lastname,
              m.ranking,
              m.club,
              COUNT(ir.id) as total_results
            FROM "Member" m
            LEFT JOIN "IndividualResult" ir 
              ON m.id = ir."memberId" 
              AND m.licence = ir."memberLicence"
            WHERE m."playerCategory" = 'SENIOR_WOMEN'
            GROUP BY m.id, m.licence, m.firstname, m.lastname, m.ranking, m.club
            HAVING COUNT(ir.id) >= 10 OR (m.ranking LIKE 'A%' AND m.ranking NOT LIKE 'As%')
          ) filtered_members
        `.then((result) => Number(result[0].count)),
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
    return getRankingEstimationTable(
      totalPlayers,
      category === PlayerCategoryDTO.SENIOR_MEN ? 'SENIOR_MEN' : 'SENIOR_WOMEN',
    );
  }

  async getLetterRankingEstimationFromNumericPoints(
    ranking: number,
    category: PlayerCategoryDTO,
  ): Promise<string> {
    const totalPlayers = await this.getMembersWithRankingCount(category);
    return (
      estimateLetterRanking(
        ranking,
        totalPlayers,
        category === PlayerCategoryDTO.SENIOR_MEN
          ? 'SENIOR_MEN'
          : 'SENIOR_WOMEN',
      ) ?? 'NC'
    );
  }
}
