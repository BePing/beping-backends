import { Injectable } from '@nestjs/common';
import {
  MemberDashboardDTOV1,
  MemberStatsDTOV1,
  MultiCategoryMemberDashboardDTOV1,
  NextMatchEstimationDTO,
  OpponentEstimationDTO,
  RankingWinLossDTOV1,
} from '../dto/member-dashboard.dto';
import { DashboardServiceInterface } from '../interfaces/dashboard-service.interface';
import { RESPONSE_STATUS, ResponseDTO } from '../dto/common.dto';
import { PlayerCategory } from '../../../entity/tabt-input.interface';
import { MatchService } from '../../../services/matches/match.service';
import {
  CacheService,
  TTL_DURATION,
} from '../../../common/cache/cache.service';
import { MemberService } from '../../../services/members/member.service';
import {
  MemberEntry,
  MemberEntryResultEntry,
  TeamMatchesEntry,
} from '../../../entity/tabt-soap/TabTAPI_Port';
import {
  NumericRankingService,
  WeeklyRankingV1Response,
} from '../../../services/members/numeric-ranking.service';
import {
  PlayerCategoryDTO,
  mapPlayerCategoryToPlayerCategoryDTO,
} from 'apps/tabt-rest/src/common/dto/player-category.dto';
import {
  MEN_RANKING_ESTIMATION,
  WOMAN_RANKING_ESTIMATION,
} from '../../../common/consts/ranking-estimation';
import {
  MatchesMembersRankerService,
  SortSystem,
} from '../../../services/matches/matches-members-ranker.service';
import { PointsEstimationService } from '../../../services/members/points-estimation.service';
import { PrismaService } from '../../../common/prisma.service';
import { PlayerCategory as PrismaPlayerCategory } from '@prisma/client';
import { result, toNumber } from 'lodash';

@Injectable()
export class MemberDashboardService
  implements DashboardServiceInterface<MemberDashboardDTOV1>
{
  constructor(
    private readonly matchService: MatchService,
    private readonly cacheService: CacheService,
    private readonly memberService: MemberService,
    private readonly numericRankingService: NumericRankingService,
    private readonly matchesMembersRankerService: MatchesMembersRankerService,
    private readonly pointsEstimationService: PointsEstimationService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * Find all player categories for a member by their unique index (licence)
   */
  private async findMemberCategoriesByLicence(
    licence: number,
  ): Promise<PrismaPlayerCategory[]> {
    const cacheKey = `member-categories:${licence}`;

    const getter = async (): Promise<PrismaPlayerCategory[]> => {
      const members = await this.prismaService.member.findMany({
        where: { licence },
        select: { playerCategory: true },
        distinct: ['playerCategory'],
      });

      return members.map((member) => member.playerCategory);
    };

    return await this.cacheService.getFromCacheOrGetAndCacheResult(
      cacheKey,
      getter,
      TTL_DURATION.ONE_HOUR,
    );
  }

  /**
   * Get dashboard data for all categories where the member exists - internal method
   */
  private async getDashboardForAllCategories(
    memberUniqueIndex: number,
    teamId?: string,
  ): Promise<{ [key in PrismaPlayerCategory]?: MemberDashboardDTOV1 }> {
    const cacheKey = `member-dashboard-all-categories:${memberUniqueIndex}${teamId ? `:${teamId}` : ''}`;

    const getter = async (): Promise<{
      [key in PrismaPlayerCategory]?: MemberDashboardDTOV1;
    }> => {
      // Find all categories for this member
      const categories =
        await this.findMemberCategoriesByLicence(memberUniqueIndex);

      if (categories.length === 0) {
        return {};
      }

      // Get dashboard for each category in parallel
      const dashboardPromises = categories.map(async (category) => {
        try {
          // Convert PrismaPlayerCategory to PlayerCategory then to PlayerCategoryDTO
          const tabtPlayerCategory =
            category === PrismaPlayerCategory.SENIOR_MEN
              ? PlayerCategory.SENIOR_MEN
              : PlayerCategory.SENIOR_WOMEN;
          const playerCategoryDTO =
            mapPlayerCategoryToPlayerCategoryDTO(tabtPlayerCategory);

          const dashboard = await this.getDashboard(
            memberUniqueIndex,
            playerCategoryDTO,
            teamId,
          );
          return { category, dashboard };
        } catch (error) {
          console.warn(
            `Failed to get dashboard for category ${category}:`,
            error.message,
          );
          return null;
        }
      });

      const results = await Promise.all(dashboardPromises);

      // Build response object — only include dashboards that loaded successfully
      const response: { [key in PrismaPlayerCategory]?: MemberDashboardDTOV1 } =
        {};
      results.forEach((result) => {
        if (result && result.dashboard?.member) {
          response[result.category] = result.dashboard;
        }
      });

      return response;
    };

    try {
      return await this.cacheService.getFromCacheOrGetAndCacheResult(
        cacheKey,
        getter,
        TTL_DURATION.ONE_HOUR,
      );
    } catch (error) {
      console.error('Error retrieving multi-category dashboard:', error);
      return {};
    }
  }

  /**
   * Get formatted multi-category dashboard for public API
   */
  async getMultiCategoryDashboard(
    memberUniqueIndex: number,
    teamId?: string,
  ): Promise<MultiCategoryMemberDashboardDTOV1> {
    try {
      const dashboards = await this.getDashboardForAllCategories(
        memberUniqueIndex,
        teamId,
      );

      if (Object.keys(dashboards).length === 0) {
        return new MultiCategoryMemberDashboardDTOV1(
          ResponseDTO.error('No member found for given id'),
        );
      }

      const response = new MultiCategoryMemberDashboardDTOV1(
        ResponseDTO.success(
          'Multi-category member dashboard retrieved successfully',
        ),
      );

      // Set dashboard data for each category
      if (dashboards[PrismaPlayerCategory.SENIOR_MEN]) {
        response.SENIOR_MEN = dashboards[PrismaPlayerCategory.SENIOR_MEN];
        response.availableCategories.push('SENIOR_MEN');
      }

      if (dashboards[PrismaPlayerCategory.SENIOR_WOMEN]) {
        response.SENIOR_WOMEN = dashboards[PrismaPlayerCategory.SENIOR_WOMEN];
        response.availableCategories.push('SENIOR_WOMEN');
      }

      return response;
    } catch (error) {
      return new MultiCategoryMemberDashboardDTOV1(
        ResponseDTO.error(
          'Error while retrieving multi-category member dashboard',
        ),
      );
    }
  }

  async getDashboard(
    memberUniqueIndex: number,
    category: PlayerCategoryDTO = PlayerCategoryDTO.SENIOR_MEN,
    teamId?: string,
  ): Promise<MemberDashboardDTOV1> {
    // Add caching for the entire dashboard
    const cacheKey = `member-dashboard:${memberUniqueIndex}:${category}${teamId ? `:${teamId}` : ''}`;

    const getter = async (): Promise<MemberDashboardDTOV1> => {
      try {
        // Get member data first as it's required for all other operations
        // IMPORTANT: Pass the category to get category-specific results
        const members = await this.memberService.getMembersV1({
          uniqueIndex: memberUniqueIndex,
          playerCategory: category,
          withResults: true,
        });

        const member: ResponseDTO<MemberEntry> = members?.[0]
          ? new ResponseDTO(RESPONSE_STATUS.SUCCESS, members[0])
          : new ResponseDTO(
              RESPONSE_STATUS.ERROR,
              undefined,
              'No member found for given id',
            );

        if (member.status === RESPONSE_STATUS.ERROR) {
          throw new Error('No member found for given id');
        }

        // Parallelize all data fetching operations
        const [numericRankingResponse, latestTeamMatches] = await Promise.all([
          this.getNumericRanking(memberUniqueIndex, category),
          this.getLatestMatches(member.payload, category),
        ]);

        // Calculate stats after getting numeric ranking to include season extremes
        const stats = await this.getMemberStats(
          member.payload,
          numericRankingResponse,
          category,
        );

        const dashboard = new MemberDashboardDTOV1(
          ResponseDTO.success('Member dashboard retrieved successfully'),
        );

        dashboard.member = member.payload;
        dashboard.numericRanking = numericRankingResponse;
        dashboard.latestTeamMatches = latestTeamMatches;
        dashboard.stats = stats;

        return dashboard;
      } catch (error) {
        throw new MemberDashboardDTOV1(ResponseDTO.error(error.message));
      }
    };

    try {
      return await this.cacheService.getFromCacheOrGetAndCacheResult(
        cacheKey,
        getter,
        TTL_DURATION.ONE_HOUR, // Cache for 1 hour
      );
    } catch (error) {
      throw new MemberDashboardDTOV1(
        ResponseDTO.error('Error while retrieving member dashboard'),
      );
    }
  }

  private async getNumericRanking(
    uniqueIndex: number,
    category: PlayerCategoryDTO,
  ) {
    const cacheKey = `numeric-ranking:${uniqueIndex}:${category}`;

    const getter = async () => {
      try {
        return await this.numericRankingService.getWeeklyRankingV1(
          uniqueIndex,
          category,
        );
      } catch (error) {
        throw new Error(error.message);
      }
    };

    return await this.cacheService.getFromCacheOrGetAndCacheResult(
      cacheKey,
      getter,
      TTL_DURATION.ONE_HOUR, // Cache for 1 hour
    );
  }

  private async getMemberStats(
    member: MemberEntry,
    numericRanking?: WeeklyRankingV1Response,
    category?: PlayerCategoryDTO,
  ): Promise<MemberStatsDTOV1> {
    const cacheKey = `member-stats:${member.UniqueIndex}${category ? `:${category}` : ''}`;

    const getter = async (): Promise<MemberStatsDTOV1> => {
      try {
        const memberResultEntries = member.ResultEntries ?? [];
        const total = memberResultEntries.length;

        if (total === 0) {
          return this.getEmptyMemberStats(member);
        }

        // Optimized: Single pass through results for basic calculations
        let victories = 0;
        let defeats = 0;
        let totalSets = 0;
        let wonSets = 0;
        let lostSets = 0;
        let tieBreakVictories = 0;
        let tieBreakDefeats = 0;

        // Time-based counters
        const timeSlots = { morning: 0, afternoon: 0, evening: 0 };
        const timeWins = { morning: 0, afternoon: 0, evening: 0 };
        const dayStats = new Array(7)
          .fill(0)
          .map(() => ({ count: 0, wins: 0 }));
        const monthStats = new Array(12)
          .fill(0)
          .map(() => ({ count: 0, wins: 0 }));
        const rankingMap = new Map<
          string,
          {
            victories: number;
            defeats: number;
            entries: MemberEntryResultEntry[];
          }
        >();

        // Create sorted indices to avoid array cloning
        const sortedIndices = memberResultEntries
          .map((_, index) => ({
            index,
            date: new Date(memberResultEntries[index].Date).getTime(),
          }))
          .sort((a, b) => a.date - b.date)
          .map((item) => item.index);

        // Single optimized pass through all results
        for (const result of memberResultEntries) {
          const isVictory = result.Result.startsWith('V');
          const matchDate = new Date(result.Date);
          const hour = matchDate.getHours();
          const dayOfWeek = matchDate.getDay();
          const month = matchDate.getMonth();

          // Basic stats
          if (isVictory) victories++;
          else defeats++;

          totalSets += result.SetFor + result.SetAgainst;
          wonSets += result.SetFor;
          lostSets += result.SetAgainst;

          // Tie break stats
          if (result.SetFor === 3 && result.SetAgainst === 2)
            tieBreakVictories++;
          else if (result.SetFor === 2 && result.SetAgainst === 3)
            tieBreakDefeats++;

          // Time of day stats
          const timeSlot =
            hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
          timeSlots[timeSlot]++;
          if (isVictory) timeWins[timeSlot]++;

          // Day of week stats
          dayStats[dayOfWeek].count++;
          if (isVictory) dayStats[dayOfWeek].wins++;

          // Monthly stats
          monthStats[month].count++;
          if (isVictory) monthStats[month].wins++;

          // Per ranking stats
          const ranking = result.Ranking;
          if (!rankingMap.has(ranking)) {
            rankingMap.set(ranking, { victories: 0, defeats: 0, entries: [] });
          }
          const rankingStat = rankingMap.get(ranking)!;
          rankingStat.entries.push(result);
          if (isVictory) rankingStat.victories++;
          else rankingStat.defeats++;
        }

        // Calculate streaks efficiently
        const {
          currentWinStreak,
          bestWinStreak,
          currentLossStreak,
          worstLossStreak,
        } = this.calculateStreaks(memberResultEntries, sortedIndices);

        // Season extremes from numeric ranking
        const seasonExtremes = this.calculateSeasonExtremes(
          member,
          numericRanking,
          memberResultEntries,
          sortedIndices,
        );

        // Build response efficiently
        return {
          matches: {
            count: total,
            victories,
            defeats,
            victoriesPct: Math.round((victories / total) * 100),
            defeatsPct: Math.round((defeats / total) * 100),
          },
          tieBreaks: {
            count: tieBreakVictories + tieBreakDefeats,
            victories: tieBreakVictories,
            defeats: tieBreakDefeats,
            victoriesPct:
              tieBreakVictories + tieBreakDefeats > 0
                ? Math.round(
                    (tieBreakVictories /
                      (tieBreakVictories + tieBreakDefeats)) *
                      100,
                  )
                : 0,
            defeatsPct:
              tieBreakVictories + tieBreakDefeats > 0
                ? Math.round(
                    (tieBreakDefeats / (tieBreakVictories + tieBreakDefeats)) *
                      100,
                  )
                : 0,
          },
          perRanking: Array.from(rankingMap.entries()).map(
            ([ranking, stats]) => ({
              ranking,
              victories: stats.victories,
              defeats: stats.defeats,
              count: stats.victories + stats.defeats,
              victoriesPct: Math.round(
                (stats.victories / (stats.victories + stats.defeats)) * 100,
              ),
              defeatsPct: Math.round(
                (stats.defeats / (stats.victories + stats.defeats)) * 100,
              ),
              players: stats.entries,
            }),
          ),
          sets: {
            total: totalSets,
            won: wonSets,
            lost: lostSets,
            wonPct: Math.round((wonSets / totalSets) * 100),
            lostPct: Math.round((lostSets / totalSets) * 100),
          },
          winStreak: {
            current: currentWinStreak,
            best: bestWinStreak,
            worst: 0,
          },
          lossStreak: {
            current: currentLossStreak,
            best: 0,
            worst: worstLossStreak,
          },
          seasonExtremes,
          matchHistory: sortedIndices.map((index) => {
            const entry = memberResultEntries[index];

            // TODO remove this once app is updated
            if (entry.Result.indexOf('V') >= 0) {
              entry.Result = 'V';
            } else {
              entry.Result = 'D';
            }


            return {
              date: entry.Date,
              result: entry.Result,
              opponentName: `${entry.FirstName} ${entry.LastName}`,
              opponentRanking: entry.Ranking,
              score: `${entry.SetFor}-${entry.SetAgainst}`,
            };
          }),
          timeOfDay: this.buildTimeOfDayStats(timeSlots, timeWins),
          dayOfWeek: this.buildDayOfWeekStats(dayStats),
          monthly: this.buildMonthlyStats(monthStats),
          matchDetails: this.calculateMatchDetails(
            memberResultEntries,
            sortedIndices,
            totalSets,
            total,
          ),
        };
      } catch (error) {
        throw new Error(error.message);
      }
    };

    return await this.cacheService.getFromCacheOrGetAndCacheResult(
      cacheKey,
      getter,
      TTL_DURATION.ONE_HOUR, // Cache for 1 hour
    );
  }

  // Helper methods for optimized stats calculation
  private getEmptyMemberStats(member: MemberEntry): MemberStatsDTOV1 {
    return {
      matches: { count: 0 },
      tieBreaks: { count: 0 },
      perRanking: [],
      sets: { total: 0, won: 0, lost: 0, wonPct: 0, lostPct: 0 },
      winStreak: { current: 0, best: 0, worst: 0 },
      lossStreak: { current: 0, best: 0, worst: 0 },
      seasonExtremes: {
        highestRanking: member.Ranking,
        lowestRanking: member.Ranking,
        highestPoints: 0,
        lowestPoints: 0,
        firstMatch: '',
        lastMatch: '',
      },
      matchHistory: [],
      timeOfDay: [],
      dayOfWeek: [],
      monthly: [],
      matchDetails: {
        averageSetsPerMatch: 0,
        cleanVictories: 0,
        cleanDefeats: 0,
        comebacks: 0,
        leadLost: 0,
      },
    };
  }

  private calculateStreaks(
    entries: MemberEntryResultEntry[],
    sortedIndices: number[],
  ) {
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let bestWinStreak = 0;
    let worstLossStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;

    // Calculate from most recent backwards for current streaks
    for (let i = sortedIndices.length - 1; i >= 0; i--) {
      const isVictory = entries[sortedIndices[i]].Result.startsWith('V');
      if (i === sortedIndices.length - 1) {
        // Initialize current streaks from most recent match
        if (isVictory) {
          currentWinStreak = 1;
          currentLossStreak = 0;
        } else {
          currentLossStreak = 1;
          currentWinStreak = 0;
        }
      } else {
        // Continue current streaks
        if (isVictory && currentWinStreak > 0) {
          currentWinStreak++;
        } else if (!isVictory && currentLossStreak > 0) {
          currentLossStreak++;
        } else {
          break; // Streak broken
        }
      }
    }

    // Calculate best/worst streaks in chronological order
    for (const index of sortedIndices) {
      const isVictory = entries[index].Result.startsWith('V');
      if (isVictory) {
        tempWinStreak++;
        tempLossStreak = 0;
        bestWinStreak = Math.max(bestWinStreak, tempWinStreak);
      } else {
        tempLossStreak++;
        tempWinStreak = 0;
        worstLossStreak = Math.max(worstLossStreak, tempLossStreak);
      }
    }

    return {
      currentWinStreak,
      bestWinStreak,
      currentLossStreak,
      worstLossStreak,
    };
  }

  private calculateSeasonExtremes(
    member: MemberEntry,
    numericRanking: WeeklyRankingV1Response | undefined,
    entries: MemberEntryResultEntry[],
    sortedIndices: number[],
  ) {
    let highestPoints = 0;
    let lowestPoints = Infinity;
    let highestRanking = member.Ranking;
    let lowestRanking = member.Ranking;

    if (numericRanking?.numericRankingHistory?.length) {
      for (const entry of numericRanking.numericRankingHistory) {
        if (entry.numericPoints > highestPoints)
          highestPoints = entry.numericPoints;
        if (entry.numericPoints < lowestPoints)
          lowestPoints = entry.numericPoints;

        if (entry.rankingLetterEstimation) {
          if (
            !highestRanking ||
            entry.rankingLetterEstimation < highestRanking
          ) {
            highestRanking = entry.rankingLetterEstimation;
          }
          if (!lowestRanking || entry.rankingLetterEstimation > lowestRanking) {
            lowestRanking = entry.rankingLetterEstimation;
          }
        }
      }
    }

    return {
      highestRanking,
      lowestRanking,
      highestPoints: Math.round(highestPoints * 100) / 100,
      lowestPoints:
        lowestPoints === Infinity ? 0 : Math.round(lowestPoints * 100) / 100,
      firstMatch: sortedIndices[0] ? entries[sortedIndices[0]].Date : '',
      lastMatch: sortedIndices[sortedIndices.length - 1]
        ? entries[sortedIndices[sortedIndices.length - 1]].Date
        : '',
    };
  }

  private buildTimeOfDayStats(
    timeSlots: Record<string, number>,
    timeWins: Record<string, number>,
  ) {
    return Object.entries(timeSlots).map(([slot, count]) => {
      const wins = timeWins[slot];
      const losses = count - wins;
      return {
        timeSlot: slot as 'morning' | 'afternoon' | 'evening',
        count,
        victories: wins,
        defeats: losses,
        victoriesPct: count > 0 ? Math.round((wins / count) * 100) : 0,
        defeatsPct: count > 0 ? Math.round((losses / count) * 100) : 0,
      };
    });
  }

  private buildDayOfWeekStats(
    dayStats: Array<{ count: number; wins: number }>,
  ) {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return days.map((day, index) => {
      const { count, wins } = dayStats[index];
      const losses = count - wins;
      return {
        day,
        count,
        victories: wins,
        defeats: losses,
        victoriesPct: count > 0 ? Math.round((wins / count) * 100) : 0,
        defeatsPct: count > 0 ? Math.round((losses / count) * 100) : 0,
      };
    });
  }

  private buildMonthlyStats(
    monthStats: Array<{ count: number; wins: number }>,
  ) {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return months.map((month, index) => {
      const { count, wins } = monthStats[index];
      const losses = count - wins;
      return {
        month,
        count,
        victories: wins,
        defeats: losses,
        victoriesPct: count > 0 ? Math.round((wins / count) * 100) : 0,
        defeatsPct: count > 0 ? Math.round((losses / count) * 100) : 0,
      };
    });
  }

  private calculateMatchDetails(
    entries: MemberEntryResultEntry[],
    sortedIndices: number[],
    totalSets: number,
    total: number,
  ) {
    let cleanVictories = 0;
    let cleanDefeats = 0;
    let comebacks = 0;
    let leadLost = 0;

    for (const index of sortedIndices) {
      const match = entries[index];
      const isVictory = match.Result.startsWith('V');
      if (isVictory && match.SetFor === 3 && match.SetAgainst === 0)
        cleanVictories++;
      else if (!isVictory && match.SetFor === 0 && match.SetAgainst === 3)
        cleanDefeats++;
      else if (isVictory && match.SetFor === 3 && match.SetAgainst === 2)
        comebacks++;
      else if (!isVictory && match.SetFor === 2 && match.SetAgainst === 3)
        leadLost++;
    }

    return {
      averageSetsPerMatch: Math.round((totalSets / total) * 100) / 100,
      cleanVictories,
      cleanDefeats,
      comebacks,
      leadLost,
    };
  }

  private async getLatestMatches(
    member: MemberEntry,
    category?: PlayerCategoryDTO,
  ): Promise<TeamMatchesEntry[]> {
    const cacheKey = `latest-matches:${member.UniqueIndex}${category ? `:${category}` : ''}`;

    const getter = async (): Promise<TeamMatchesEntry[]> => {
      try {
        const matchIds = (member.ResultEntries ?? [])
          .map((result) => result.MatchId)
          .filter((item, pos, arr) => arr.indexOf(item) === pos);
          
        if (matchIds.length === 0) return [];

        const clubMatches: TeamMatchesEntry[] =
          await this.matchService.getMatches({ Club: member.Club });
        return clubMatches.filter((match) => matchIds.includes(match.MatchId));
      } catch (error) {
        throw new Error(error.message);
      }
    };

    return await this.cacheService.getFromCacheOrGetAndCacheResult(
      cacheKey,
      getter,
      TTL_DURATION.ONE_HOUR,
    );
  }

  private async getNextMatchEstimation(
    member: MemberEntry,
    teamId: string,
    category: PlayerCategoryDTO,
  ): Promise<NextMatchEstimationDTO | undefined> {
    const cacheKey = `next-match-estimation:${member.UniqueIndex}:${teamId}:${category}`;

    const getter = async (): Promise<NextMatchEstimationDTO | undefined> => {
      try {
        // Get team matches and player ranking in parallel
        const [matches, playerRanking] = await Promise.all([
          this.matchService.getMatches({
            Club: member.Club,
            Team: teamId,
            WithDetails: true,
          }),
          this.numericRankingService.getWeeklyRankingV1(
            member.UniqueIndex,
            category,
          ),
        ]);

        // Find the next match
        const now = new Date();
        const nextMatch = matches.find((match) => new Date(match.Date) > now);

        if (!nextMatch) {
          return undefined;
        }

        const isHomeTeam =
          nextMatch.HomeClub === member.Club && nextMatch.HomeTeam === teamId;
        const opponentClub = isHomeTeam
          ? nextMatch.AwayClub
          : nextMatch.HomeClub;
        const divisionId = nextMatch.DivisionId;

        // Get division players and filter opponents
        const divisionPlayers =
          await this.matchesMembersRankerService.getMembersRankingFromDivision(
            Number(divisionId),
            SortSystem.MOST_PLAYED,
          );

        const opponentPlayers = divisionPlayers
          .filter((player) => player.club === opponentClub)
          .slice(0, 6); // Reduced from 8 to 6 to minimize calls

        if (!opponentPlayers.length) {
          return undefined;
        }

        const latestPlayerRanking =
          playerRanking.numericRankingHistory.at(-1);
        if (!latestPlayerRanking) {
          return undefined;
        }
        const playerPoints = latestPlayerRanking.numericPoints;

        // OPTIMIZED: Sequential processing to avoid cache stampede
        // Instead of parallel batches, process sequentially to allow cache to work
        const opponentPlayersRanking = [];

        for (const player of opponentPlayers) {
          try {
            const ranking = await this.numericRankingService.getWeeklyRankingV1(
              player.uniqueIndex,
              category,
            );
            const latestRanking = ranking.numericRankingHistory.at(-1);
            if (!latestRanking) continue;

            opponentPlayersRanking.push({
              ...player,
              rankingLetter: latestRanking.rankingLetterEstimation,
              points: latestRanking.numericPoints,
            });
          } catch (error) {
            // Skip players we can't get ranking for
            console.warn(
              `Failed to get ranking for player ${player.uniqueIndex}:`,
              error.message,
            );
            continue;
          }
        }

        if (!opponentPlayersRanking.length) {
          return undefined;
        }

        // Calculate estimations
        const calculateOpponentPoints = (
          opponent: (typeof opponentPlayersRanking)[0],
        ): OpponentEstimationDTO => {
          const estimation = this.pointsEstimationService.estimatePoints(
            playerPoints,
            opponent.points,
            nextMatch.DivisionName,
            category,
          );

          const pointsDifference = playerPoints - opponent.points;
          const isExpectedWin = pointsDifference > 0;

          return {
            firstName: opponent.firstName,
            lastName: opponent.lastName,
            ranking: opponent.rankingLetter,
            pointsToWin: isExpectedWin
              ? estimation.expectedWinPoints
              : estimation.unexpectedWinPoints,
            coefficient: estimation.coefficient,
            isExpectedWin,
            pointsDifference: Math.abs(pointsDifference),
          };
        };

        // Optimize sorting by calculating point differences once
        const opponentsWithDiff = opponentPlayersRanking.map((opponent) => ({
          ...opponent,
          pointsDiff: Math.abs(opponent.points - playerPoints),
        }));

        // Get best and worst case scenarios - limit to 3 each to reduce complexity
        const maxOpponents = Math.min(3, opponentsWithDiff.length);

        const bestCase = opponentsWithDiff
          .sort((a, b) => b.pointsDiff - a.pointsDiff)
          .slice(0, maxOpponents)
          .map(calculateOpponentPoints);

        const worstCase = opponentsWithDiff
          .sort((a, b) => a.pointsDiff - b.pointsDiff)
          .slice(0, maxOpponents)
          .map(calculateOpponentPoints);

        return {
          matchId: nextMatch.MatchId,
          date: nextMatch.Date,
          homeTeam: `${nextMatch.HomeClub} ${nextMatch.HomeTeam}`,
          awayTeam: `${nextMatch.AwayClub} ${nextMatch.AwayTeam}`,
          bestCase,
          worstCase,
        };
      } catch (error) {
        console.error('Error getting next match estimation:', error);
        return undefined;
      }
    };

    return await this.cacheService.getFromCacheOrGetAndCacheResult(
      cacheKey,
      getter,
      TTL_DURATION.ONE_HOUR, // Cache for 1 hour
    );
  }

  private getRankingPoints(
    ranking: string,
    category: PlayerCategoryDTO,
  ): number {
    // Get base points for each ranking from the ranking estimation tables
    const estimationTable =
      category === PlayerCategoryDTO.SENIOR_MEN
        ? MEN_RANKING_ESTIMATION['15000']
        : WOMAN_RANKING_ESTIMATION['15000'];

    return estimationTable[ranking] || 0;
  }
}
