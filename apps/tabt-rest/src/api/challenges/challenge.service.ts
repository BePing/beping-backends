import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaService } from '@app/common';
import {
  ChallengePlayerRankingDto,
  ChallengePlayerRankingsResponseDto,
  ChallengePublicationDto,
  ChallengeRankingPageDto,
  ChallengeRankingsQueryDto,
  ChallengeRegionSummaryDto,
  ChallengeSeasonQueryDto,
  ChallengeSummaryDto,
} from './dto/challenge.dto';

interface PublicSeason {
  id: string;
  season: number;
  challenge: {
    slug: string;
    name: string;
    unofficial: boolean;
    unofficialLabel: string;
  };
}

type PublicPublication = Awaited<
  ReturnType<ChallengeService['findPublicationForSeason']>
>;

@Injectable()
export class ChallengeService {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveChallenges(now = new Date()): Promise<ChallengeSummaryDto[]> {
    const today = new Date(`${this.dateInBrussels(now)}T00:00:00.000Z`);
    const challenges = await this.prisma.challenge.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        seasons: {
          where: { active: true },
          orderBy: { season: 'desc' },
          take: 1,
          include: {
            regions: { orderBy: { displayOrder: 'asc' } },
            levels: { orderBy: { displayOrder: 'asc' } },
            clubs: { orderBy: { clubIndex: 'asc' } },
            championshipWeeks: {
              where: { active: true, thursdayPublishDate: { gte: today } },
              orderBy: { thursdayPublishDate: 'asc' },
              take: 2,
            },
          },
        },
      },
    });

    return challenges.map((challenge) => {
      const season = challenge.seasons[0];
      const nextPublicationAt = season?.championshipWeeks
        .map((week) =>
          this.brusselsScheduledAt(
            week.thursdayPublishDate,
            season.thursdayPublishTime,
          ),
        )
        .find((scheduledAt) => scheduledAt > now);
      return {
        slug: challenge.slug,
        name: challenge.name,
        shortName: challenge.shortName ?? undefined,
        description: challenge.description ?? undefined,
        unofficial: challenge.unofficial,
        unofficialLabel: challenge.unofficialLabel,
        displayOrder: challenge.displayOrder,
        activeSeason: season?.season,
        nextPublicationAt,
        regions:
          season?.regions.map((region) => ({
            code: region.code,
            label: region.label,
          })) ?? [],
        levels:
          season?.levels.map((level) => ({
            code: level.code,
            label: level.label,
          })) ?? [],
        clubs: season?.clubs.map((club) => club.clubIndex) ?? [],
      };
    });
  }

  async getLatestPublication(
    slug: string,
    query: ChallengeSeasonQueryDto,
  ): Promise<ChallengePublicationDto | undefined> {
    const season = await this.findPublicSeason(slug, query.season);
    const publication = await this.findPublicationForSeason(season.id);
    return publication ? this.toPublicationDto(season, publication) : undefined;
  }

  async getRankings(
    slug: string,
    query: ChallengeRankingsQueryDto,
  ): Promise<ChallengeRankingPageDto> {
    const season = await this.findPublicSeason(slug, query.season);
    const publication = await this.findPublicationForSeason(
      season.id,
      query.week,
    );
    if (!publication) return { items: [] };

    const search = query.search?.trim();
    const numericSearch = search ? Number.parseInt(search, 10) : undefined;
    const where: Prisma.ChallengeRankingWhereInput = {
      runId: publication.runId,
      ...(query.region ? { regionCode: query.region } : {}),
      ...(query.level ? { levelCode: query.level } : {}),
      ...(search
        ? {
            OR: [
              { playerName: { contains: search, mode: 'insensitive' } },
              { clubName: { contains: search, mode: 'insensitive' } },
              ...(Number.isSafeInteger(numericSearch)
                ? [{ playerUniqueIndex: numericSearch }]
                : []),
            ],
          }
        : {}),
    };

    const rows = await this.prisma.challengeRanking.findMany({
      where,
      orderBy: [
        { regionCode: 'asc' },
        { levelCode: 'asc' },
        { position: 'asc' },
        { id: 'asc' },
      ],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);

    return {
      publication: this.toPublicationDto(season, publication),
      items: page.map((ranking) =>
        this.toPlayerRankingDto(season, publication, ranking),
      ),
      nextCursor: hasMore ? page.at(-1)?.id : undefined,
    };
  }

  async getChallengePlayerRankings(
    slug: string,
    playerUniqueIndex: number,
    query: ChallengeSeasonQueryDto,
  ): Promise<ChallengePlayerRankingsResponseDto> {
    const season = await this.findPublicSeason(slug, query.season);
    const publications = await this.prisma.challengePublication.findMany({
      where: { seasonId: season.id },
      orderBy: { publishedAt: 'desc' },
      include: { championshipWeek: true, run: true },
    });
    if (publications.length === 0) {
      return { hasRanking: false, rankings: [], points: [] };
    }

    const rows = await this.prisma.challengeRanking.findMany({
      where: {
        playerUniqueIndex,
        runId: { in: publications.map((publication) => publication.runId) },
      },
    });
    const rankingByRunId = new Map(rows.map((row) => [row.runId, row]));
    const rankings = publications.flatMap((publication) => {
      const ranking = rankingByRunId.get(publication.runId);
      return ranking
        ? [this.toPlayerRankingDto(season, publication, ranking)]
        : [];
    });

    const latestRankedPublication = publications.find((publication) =>
      rankingByRunId.has(publication.runId),
    );
    const points = latestRankedPublication
      ? await this.prisma.challengePlayerPoint.findMany({
          where: {
            runId: latestRankedPublication.runId,
            playerUniqueIndex,
          },
          orderBy: { week: 'desc' },
        })
      : [];
    return {
      hasRanking: rankings.length > 0,
      rankings,
      points: points.map((point) => ({
        matchUniqueId: point.matchUniqueId,
        matchId: point.matchId,
        divisionId: point.divisionId,
        week: point.week,
        levelCode: point.levelCode,
        victoryCount: point.victoryCount,
        forfeit: point.forfeit,
        pointsWon: point.pointsWon,
      })),
    };
  }

  async getMemberChallengeRankings(
    playerUniqueIndex: number,
  ): Promise<ChallengePlayerRankingDto[]> {
    const seasons = await this.prisma.challengeSeason.findMany({
      where: { active: true, challenge: { active: true } },
      include: { challenge: true },
    });
    if (seasons.length === 0) return [];

    const publications = await this.prisma.challengePublication.findMany({
      where: { seasonId: { in: seasons.map((season) => season.id) } },
      orderBy: { publishedAt: 'desc' },
      include: { championshipWeek: true, run: true },
    });
    const latestBySeason = new Map<string, (typeof publications)[number]>();
    for (const publication of publications) {
      if (!latestBySeason.has(publication.seasonId)) {
        latestBySeason.set(publication.seasonId, publication);
      }
    }
    const latest = [...latestBySeason.values()];
    if (latest.length === 0) return [];

    const rows = await this.prisma.challengeRanking.findMany({
      where: {
        playerUniqueIndex,
        runId: { in: latest.map((publication) => publication.runId) },
      },
    });
    const seasonById = new Map(seasons.map((season) => [season.id, season]));
    const publicationByRunId = new Map(
      latest.map((publication) => [publication.runId, publication]),
    );

    return rows
      .flatMap((ranking) => {
        const publication = publicationByRunId.get(ranking.runId);
        const season = publication
          ? seasonById.get(publication.seasonId)
          : undefined;
        return publication && season
          ? [
              this.toPlayerRankingDto(
                {
                  id: season.id,
                  season: season.season,
                  challenge: season.challenge,
                },
                publication,
                ranking,
              ),
            ]
          : [];
      })
      .sort((a, b) => a.challengeName.localeCompare(b.challengeName));
  }

  async getRegionSummary(
    slug: string,
    regionCode: string,
    query: ChallengeSeasonQueryDto,
  ): Promise<ChallengeRegionSummaryDto | undefined> {
    const season = await this.findPublicSeason(slug, query.season);
    const publication = await this.findPublicationForSeason(season.id);
    if (!publication) return undefined;
    const summary = await this.prisma.challengeRegionSummary.findUnique({
      where: {
        runId_regionCode: { runId: publication.runId, regionCode },
      },
    });
    if (!summary) return undefined;

    return {
      challengeSlug: season.challenge.slug,
      challengeName: season.challenge.name,
      season: season.season,
      week: publication.championshipWeek.week,
      regionCode: summary.regionCode,
      regionLabel: summary.regionLabel,
      totalPlayers: summary.totalPlayers,
      playersByLevel: summary.playersByLevel as Record<string, number>,
      clubs: summary.clubs,
      aiSummary: summary.aiSummary as Record<string, unknown> | undefined,
      publishedAt: publication.publishedAt,
    };
  }

  private async findPublicSeason(
    slug: string,
    requestedSeason?: number,
  ): Promise<PublicSeason> {
    const challenge = await this.prisma.challenge.findFirst({
      where: { slug, active: true },
      select: {
        slug: true,
        name: true,
        unofficial: true,
        unofficialLabel: true,
        seasons: {
          where: requestedSeason
            ? { season: requestedSeason }
            : { active: true },
          orderBy: { season: 'desc' },
          take: 1,
          select: { id: true, season: true },
        },
      },
    });
    const season = challenge?.seasons[0];
    if (!challenge || !season) {
      throw new NotFoundException(`Active challenge season not found: ${slug}`);
    }
    return {
      id: season.id,
      season: season.season,
      challenge: {
        slug: challenge.slug,
        name: challenge.name,
        unofficial: challenge.unofficial,
        unofficialLabel: challenge.unofficialLabel,
      },
    };
  }

  private async findPublicationForSeason(seasonId: string, week?: number) {
    return this.prisma.challengePublication.findFirst({
      where: {
        seasonId,
        ...(week ? { championshipWeek: { week } } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      include: { championshipWeek: true, run: true },
    });
  }

  private toPublicationDto(
    season: PublicSeason,
    publication: NonNullable<PublicPublication>,
  ): ChallengePublicationDto {
    return {
      challengeSlug: season.challenge.slug,
      challengeName: season.challenge.name,
      season: season.season,
      week: publication.championshipWeek.week,
      publishedAt: publication.publishedAt,
      checksum: publication.run.checksum ?? '',
      totalPlayers: publication.run.totalPlayers,
    };
  }

  private toPlayerRankingDto(
    season: PublicSeason,
    publication: NonNullable<PublicPublication>,
    ranking: {
      playerUniqueIndex: number;
      playerName: string;
      clubIndex: string;
      clubName: string;
      regionCode: string;
      regionLabel: string;
      levelCode: string;
      levelLabel: string;
      position: number;
      totalParticipants: number;
      points: number;
      count5Pts: number;
      count3Pts: number;
      count2Pts: number;
      count1Pts: number;
      count0Pts: number;
    },
  ): ChallengePlayerRankingDto {
    return {
      challengeSlug: season.challenge.slug,
      challengeName: season.challenge.name,
      unofficial: season.challenge.unofficial,
      unofficialLabel: season.challenge.unofficialLabel,
      season: season.season,
      week: publication.championshipWeek.week,
      playerUniqueIndex: ranking.playerUniqueIndex,
      playerName: ranking.playerName,
      clubIndex: ranking.clubIndex,
      clubName: ranking.clubName,
      regionCode: ranking.regionCode,
      regionLabel: ranking.regionLabel,
      levelCode: ranking.levelCode,
      levelLabel: ranking.levelLabel,
      position: ranking.position,
      totalParticipants: ranking.totalParticipants,
      points: ranking.points,
      breakdown: {
        count5Pts: ranking.count5Pts,
        count3Pts: ranking.count3Pts,
        count2Pts: ranking.count2Pts,
        count1Pts: ranking.count1Pts,
        count0Pts: ranking.count0Pts,
      },
      publishedAt: publication.publishedAt,
    };
  }

  private dateInBrussels(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Brussels',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const date = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    return `${date.year}-${date.month}-${date.day}`;
  }

  private brusselsScheduledAt(date: Date, localTime: string): Date {
    const [hour, minute] = localTime.split(':').map(Number);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const guess = new Date(Date.UTC(year, month, day, hour, minute));
    const zonedParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Brussels',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(guess);
    const zoned = Object.fromEntries(
      zonedParts.map((part) => [part.type, part.value]),
    );
    const offset =
      Date.UTC(
        Number(zoned.year),
        Number(zoned.month) - 1,
        Number(zoned.day),
        Number(zoned.hour),
        Number(zoned.minute),
      ) - guess.getTime();
    return new Date(guess.getTime() - offset);
  }
}
