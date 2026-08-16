import { Injectable, Logger } from '@nestjs/common';
import {
  ChallengeRunStatus,
  ChallengeRunType,
  PostHogService,
  PrismaService,
} from '@app/common';
import { Pool, PoolClient } from 'pg';
import { ChallengeCalculatorService } from './challenge-calculator.service';
import { ChallengeConfigValidatorService } from './challenge-config-validator.service';
import { ChallengePressService } from './challenge-press.service';
import {
  ChallengeScheduledJob,
  ComputedRanking,
} from './challenge-worker.types';
import { computeRankingChecksum } from './challenge-checksum';
import { dateInBrussels } from './challenge-date';

export interface ChallengeJobResult {
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED_NO_CHAMPIONSHIP_WEEK';
  challengeSlug?: string;
  season?: number;
  week?: number;
  runId?: string;
  durationMs?: number;
  totalPlayers?: number;
  checksum?: string;
  pressSent?: boolean;
  published?: boolean;
  error?: string;
}

@Injectable()
export class ChallengeOrchestratorService {
  private readonly logger = new Logger(ChallengeOrchestratorService.name);
  private readonly lockPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX ?? 1),
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: ChallengeCalculatorService,
    private readonly press: ChallengePressService,
    private readonly validator: ChallengeConfigValidatorService,
    private readonly posthog: PostHogService,
  ) {}

  async run(
    job: ChallengeScheduledJob,
    date = dateInBrussels(),
  ): Promise<ChallengeJobResult[]> {
    const dateValue = new Date(`${date}T00:00:00.000Z`);
    const dateField =
      job === 'sunday'
        ? 'championshipSunday'
        : job === 'monday'
          ? 'mondayRunDate'
          : 'thursdayPublishDate';
    const weeks = await this.prisma.challengeChampionshipWeek.findMany({
      where: {
        active: true,
        [dateField]: dateValue,
        season: { active: true, challenge: { active: true } },
      },
      include: { season: { include: { challenge: true } } },
      orderBy: { season: { challenge: { displayOrder: 'asc' } } },
    });
    if (weeks.length === 0) {
      this.posthog.log('challenge job completed', 'info', {
        event: 'challenge.job.completed',
        source: 'challenge-worker',
        job,
        outcome: 'skipped',
        reason: 'no_championship_week',
      });
      return [{ status: 'SKIPPED_NO_CHAMPIONSHIP_WEEK' }];
    }

    const results: ChallengeJobResult[] = [];
    for (const week of weeks) {
      const startedAt = Date.now();
      const base = {
        challengeSlug: week.season.challenge.slug,
        season: week.season.season,
        week: week.week,
      };
      try {
        await this.validator.assertSeasonValid(week.seasonId);
        const result = await this.withLock(
          `${week.seasonId}:${week.id}:${job}`,
          () =>
            job === 'thursday'
              ? this.publish(week.id)
              : this.compute(
                  week.id,
                  job === 'sunday'
                    ? 'SUNDAY_PRESS_DRAFT'
                    : 'MONDAY_PRESS_FINAL',
                ),
        );
        const completedRun = await this.prisma.challengeRun.findUniqueOrThrow({
          where: { id: result },
          select: {
            totalPlayers: true,
            checksum: true,
            pressSentAt: true,
            publishedAt: true,
          },
        });
        const completed: ChallengeJobResult = {
          status: 'SUCCESS',
          ...base,
          runId: result,
          durationMs: Date.now() - startedAt,
          totalPlayers: completedRun.totalPlayers,
          checksum: completedRun.checksum ?? undefined,
          pressSent: completedRun.pressSentAt !== null,
          published: completedRun.publishedAt !== null,
        };
        this.logger.log(
          JSON.stringify({ event: 'CHALLENGE_JOB_METRIC', job, ...completed }),
        );
        this.posthog.capture(
          'challenge_job_completed',
          `challenge:${base.challengeSlug}`,
          { job, ...completed },
        );
        this.posthog.log('challenge job completed', 'info', {
          event: 'challenge.job.completed',
          source: 'challenge-worker',
          job,
          challenge_slug: base.challengeSlug,
          season: base.season,
          week: base.week,
          outcome: 'success',
          duration_ms: completed.durationMs,
          total_players: completed.totalPlayers,
          published: completed.published,
          press_sent: completed.pressSent,
        });
        results.push(completed);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failed: ChallengeJobResult = {
          status: 'FAILED',
          ...base,
          durationMs: Date.now() - startedAt,
          error: message,
        };
        this.logger.error(
          JSON.stringify({ event: 'CHALLENGE_JOB_ALERT', job, ...failed }),
        );
        this.posthog.captureException(
          error,
          `challenge:${base.challengeSlug}`,
          {
            source: 'challenge-worker',
            job,
            ...failed,
          },
        );
        this.posthog.log('challenge job completed', 'error', {
          event: 'challenge.job.completed',
          source: 'challenge-worker',
          job,
          challenge_slug: base.challengeSlug,
          season: base.season,
          week: base.week,
          outcome: 'failure',
          duration_ms: failed.durationMs,
          error_type:
            error instanceof Error ? error.constructor.name : 'UnknownError',
        });
        results.push(failed);
      }
    }
    return results;
  }

  async close(): Promise<void> {
    await this.lockPool.end();
  }

  private async compute(
    championshipWeekId: string,
    type: ChallengeRunType,
  ): Promise<string> {
    const week = await this.prisma.challengeChampionshipWeek.findUniqueOrThrow({
      where: { id: championshipWeekId },
      include: { season: true },
    });
    const last = await this.prisma.challengeRun.findFirst({
      where: { championshipWeekId, type },
      orderBy: { attempt: 'desc' },
      include: { pressDelivery: true },
    });
    if (
      last &&
      ['PRESS_SENT', 'READY_FOR_PUBLICATION', 'PUBLISHED'].includes(last.status)
    ) {
      return last.id;
    }
    if (
      last?.status === 'DELIVERY_UNKNOWN' ||
      (last?.status === 'COMPUTED' && last.pressDelivery?.status === 'PENDING')
    ) {
      throw new Error(
        'Previous press delivery is uncertain; manual resolution required',
      );
    }
    const run = await this.prisma.challengeRun.create({
      data: {
        championshipWeekId,
        type,
        attempt: (last?.attempt ?? 0) + 1,
        sourceVersion:
          process.env.CHALLENGE_WORKER_IMAGE_SHA ??
          process.env.npm_package_version ??
          'development',
      },
    });
    try {
      const computation = await this.calculator.calculate(
        week.seasonId,
        week.week,
      );
      await this.prisma.$transaction(
        async (tx) => {
          await tx.challengeRanking.createMany({
            data: computation.rankings.map((ranking) => ({
              runId: run.id,
              ...ranking,
            })),
          });
          await tx.challengePlayerPoint.createMany({
            data: computation.points.map((point) => ({
              runId: run.id,
              playerUniqueIndex: point.playerUniqueIndex,
              matchUniqueId: point.matchUniqueId,
              matchId: point.matchId,
              divisionId: point.divisionId,
              week: point.week,
              levelCode: point.levelCode,
              victoryCount: point.victoryCount,
              forfeit: point.forfeit,
              pointsWon: point.pointsWon,
            })),
          });
          await Promise.all(
            computation.regionSummaries.map((summary) =>
              tx.challengeRegionSummary.create({
                data: {
                  runId: run.id,
                  ...summary,
                  playersByLevel: summary.playersByLevel,
                },
              }),
            ),
          );
          await tx.challengeRun.update({
            where: { id: run.id },
            data: {
              status: 'COMPUTED',
              checksum: computation.checksum,
              totalPlayers: new Set(
                computation.rankings.map(
                  (ranking) => ranking.playerUniqueIndex,
                ),
              ).size,
              totalRankings: computation.rankings.length,
              computedAt: new Date(),
            },
          });
        },
        { timeout: 120_000 },
      );

      await this.prisma.challengePressDelivery.create({
        data: {
          runId: run.id,
          status: 'PENDING',
          attemptCount: 1,
        },
      });
      const delivery = await this.press.send(
        week.seasonId,
        week.week,
        type,
        computation,
      );
      const status: ChallengeRunStatus =
        delivery.status === 'SENT'
          ? type === 'MONDAY_PRESS_FINAL'
            ? 'READY_FOR_PUBLICATION'
            : 'PRESS_SENT'
          : delivery.status === 'UNKNOWN'
            ? 'DELIVERY_UNKNOWN'
            : 'FAILED';
      await this.prisma.$transaction([
        this.prisma.challengePressDelivery.update({
          where: { runId: run.id },
          data: {
            status: delivery.status,
            providerMessageId: delivery.providerMessageId,
            sentAt: delivery.status === 'SENT' ? new Date() : undefined,
            lastError: delivery.error,
          },
        }),
        this.prisma.challengeRun.update({
          where: { id: run.id },
          data: {
            status,
            pressSentAt: delivery.status === 'SENT' ? new Date() : undefined,
            completedAt: new Date(),
            failureReason: delivery.error,
          },
        }),
      ]);
      if (status === 'FAILED' || status === 'DELIVERY_UNKNOWN') {
        throw new Error(delivery.error ?? `Press delivery ${delivery.status}`);
      }
      return run.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const current = await this.prisma.challengeRun.findUnique({
        where: { id: run.id },
        include: { pressDelivery: true },
      });
      if (
        current?.status === 'COMPUTED' &&
        current.pressDelivery?.status === 'PENDING'
      ) {
        await this.prisma.$transaction([
          this.prisma.challengePressDelivery.update({
            where: { runId: run.id },
            data: {
              status: 'UNKNOWN',
              lastError: 'Press delivery interrupted before confirmation',
            },
          }),
          this.prisma.challengeRun.update({
            where: { id: run.id },
            data: {
              status: 'DELIVERY_UNKNOWN',
              completedAt: new Date(),
              failureReason: message.slice(0, 2_000),
            },
          }),
        ]);
      } else if (
        current?.status === 'RUNNING' ||
        current?.status === 'COMPUTED'
      ) {
        await this.prisma.challengeRun.update({
          where: { id: run.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            failureReason: message.slice(0, 2_000),
          },
        });
      }
      throw error;
    }
  }

  private async publish(championshipWeekId: string): Promise<string> {
    const week = await this.prisma.challengeChampionshipWeek.findUniqueOrThrow({
      where: { id: championshipWeekId },
      include: { season: { include: { challenge: true } } },
    });
    const run = await this.prisma.challengeRun.findFirst({
      where: {
        championshipWeekId,
        type: 'MONDAY_PRESS_FINAL',
        status: { in: ['READY_FOR_PUBLICATION', 'PUBLISHED'] },
        pressDelivery: { status: 'SENT' },
      },
      orderBy: { attempt: 'desc' },
      include: {
        rankings: {
          orderBy: [
            { regionCode: 'asc' },
            { levelCode: 'asc' },
            { position: 'asc' },
          ],
        },
      },
    });
    if (!run?.checksum) {
      throw new Error('No publishable Monday run; previous publication kept');
    }
    const rankings: ComputedRanking[] = run.rankings.map((ranking) => ({
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
      count5Pts: ranking.count5Pts,
      count3Pts: ranking.count3Pts,
      count2Pts: ranking.count2Pts,
      count1Pts: ranking.count1Pts,
      count0Pts: ranking.count0Pts,
    }));
    const checksum = computeRankingChecksum(rankings);
    if (checksum !== run.checksum) {
      throw new Error('Monday run checksum mismatch; publication blocked');
    }
    const now = new Date();
    const integrationConfig = (week.season.challenge.integrationConfig ??
      {}) as Record<string, unknown>;
    const publicWebBaseUrl = String(
      integrationConfig.publicWebBaseUrl ??
        process.env.CHALLENGE_PUBLIC_BASE_URL ??
        'https://challenges.beping.be',
    ).replace(/\/$/, '');
    const publicationUrl = `${publicWebBaseUrl}/challenges/${encodeURIComponent(week.season.challenge.slug)}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.challengePublication.upsert({
        where: { championshipWeekId },
        create: {
          seasonId: week.seasonId,
          championshipWeekId,
          runId: run.id,
          publishedAt: now,
        },
        update: { runId: run.id, publishedAt: now },
      });
      await tx.challengeRun.update({
        where: { id: run.id },
        data: { status: 'PUBLISHED', publishedAt: now },
      });
      await tx.notificationOutbox.upsert({
        where: {
          deduplicationKey: `challenge-published:${week.season.challenge.slug}:${week.season.season}:${week.week}`,
        },
        create: {
          type: 'CHALLENGE_PUBLISHED',
          deduplicationKey: `challenge-published:${week.season.challenge.slug}:${week.season.season}:${week.week}`,
          payload: {
            challengeSlug: week.season.challenge.slug,
            challengeName: week.season.challenge.name,
            season: week.season.season,
            week: week.week,
            publishedAt: now.toISOString(),
            publicationUrl,
          },
        },
        update: {},
      });
    });
    return run.id;
  }

  private async withLock<T>(key: string, work: () => Promise<T>): Promise<T> {
    let client: PoolClient | undefined;
    try {
      client = await this.lockPool.connect();
      const result = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired',
        [key],
      );
      if (!result.rows[0]?.acquired) {
        throw new Error('Challenge job is already running');
      }
      return await work();
    } finally {
      if (client) {
        await client.query(
          'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
          [key],
        );
        client.release();
      }
    }
  }
}
