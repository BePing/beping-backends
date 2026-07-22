import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { NotificationType, PrismaService } from '@app/common';
import { FcmService } from './fcm.service';
import {
  NotificationContentService,
  RankingNotificationPayload,
} from './notification-content.service';

interface OutboxEvent {
  id: string;
  type: 'PLAYER_RANKING_UPDATED' | 'RESULT_UPDATED';
  payload: unknown;
  attempts: number;
}

interface PlayerRankingUpdatedPayload extends RankingNotificationPayload {
  uniqueIndex: number;
  playerCategory: string;
  effectiveDate: string;
}

interface ResultUpdatedPayload {
  resultId: number;
  competitionId: string;
  competitionName?: string | null;
  playerCategory: string;
  resultDate: string;
  playerUniqueIndexes: number[];
  clubIds: string[];
  result: string;
  score: string;
}

@Injectable()
export class NotificationOutboxService implements OnModuleInit {
  private readonly logger = new Logger(NotificationOutboxService.name);
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
    private readonly content: NotificationContentService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.recoverStaleEvents();
  }

  private async recoverStaleEvents(): Promise<void> {
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
    const recovered = await this.prisma.notificationOutbox.updateMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: staleBefore },
      },
      data: {
        status: 'PENDING',
        availableAt: new Date(),
        lastError: 'Recovered after an interrupted delivery attempt',
      },
    });

    if (recovered.count > 0) {
      this.logger.warn(`Recovered ${recovered.count} stale outbox events`);
    }
  }

  @Interval(10_000)
  async processPendingEvents(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      await this.recoverStaleEvents();
      const events = await this.claimPendingEvents();
      if (events.length === 0) return;

      const rankingEvents = events.filter(
        (event) => event.type === 'PLAYER_RANKING_UPDATED',
      );
      for (const event of rankingEvents) {
        await this.processGroup([event], () => this.sendRankingEvent(event));
      }

      const resultGroups = new Map<string, OutboxEvent[]>();
      for (const event of events.filter(
        (candidate) => candidate.type === 'RESULT_UPDATED',
      )) {
        const payload = event.payload as ResultUpdatedPayload;
        const key = `${payload.playerCategory}:${payload.competitionId}`;
        const group = resultGroups.get(key) || [];
        group.push(event);
        resultGroups.set(key, group);
      }

      for (const group of resultGroups.values()) {
        await this.processGroup(group, () => this.sendResultEvents(group));
      }
    } finally {
      this.processing = false;
    }
  }

  private async claimPendingEvents(): Promise<OutboxEvent[]> {
    return this.prisma.$queryRaw<OutboxEvent[]>`
      WITH candidates AS (
        SELECT id
        FROM "NotificationOutbox"
        WHERE status = 'PENDING'::"NotificationOutboxStatus"
          AND "availableAt" <= NOW()
        ORDER BY "availableAt", "createdAt"
        LIMIT 200
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "NotificationOutbox" AS outbox
      SET
        status = 'PROCESSING'::"NotificationOutboxStatus",
        attempts = outbox.attempts + 1,
        "updatedAt" = NOW()
      FROM candidates
      WHERE outbox.id = candidates.id
      RETURNING outbox.id, outbox.type, outbox.payload, outbox.attempts
    `;
  }

  private async processGroup(
    events: OutboxEvent[],
    send: () => Promise<void>,
  ): Promise<void> {
    try {
      await send();
      await this.prisma.notificationOutbox.updateMany({
        where: { id: { in: events.map((event) => event.id) } },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Notification delivery failed for ${events.map((event) => event.id).join(', ')}`,
        error instanceof Error ? error.stack : undefined,
      );

      await Promise.all(
        events.map((event) => {
          const failedPermanently = event.attempts >= 8;
          const retryDelayMs = Math.min(
            60 * 60 * 1000,
            30_000 * 2 ** Math.max(0, event.attempts - 1),
          );

          return this.prisma.notificationOutbox.update({
            where: { id: event.id },
            data: {
              status: failedPermanently ? 'FAILED' : 'PENDING',
              availableAt: failedPermanently
                ? new Date()
                : new Date(Date.now() + retryDelayMs),
              lastError: message.slice(0, 2000),
            },
          });
        }),
      );
    }
  }

  private async sendRankingEvent(event: OutboxEvent): Promise<void> {
    const payload = event.payload as PlayerRankingUpdatedPayload;
    const topic = `player:${payload.uniqueIndex}`;
    const devicesByLocale = await this.fcm.getDevicesByTopicsGroupedByLocale(
      [topic],
      NotificationType.RANKING,
    );

    for (const [locale, tokens] of Object.entries(devicesByLocale)) {
      const content = this.content.ranking(locale, payload);
      await this.fcm.sendNotification({
        ...content,
        notificationType: NotificationType.RANKING,
        targetDeviceTokens: tokens,
        data: this.toStringData({
          eventType: 'playerRankingUpdated',
          uniqueIndex: payload.uniqueIndex,
          playerCategory: payload.playerCategory,
          effectiveDate: payload.effectiveDate,
          oldPoints: payload.oldPoints,
          newPoints: payload.newPoints,
          oldNumericRanking: payload.oldNumericRanking,
          newNumericRanking: payload.newNumericRanking,
          oldRankingEstimation: payload.oldRankingEstimation,
          newRankingEstimation: payload.newRankingEstimation,
        }),
      });
    }
  }

  private async sendResultEvents(events: OutboxEvent[]): Promise<void> {
    const payloads = events.map(
      (event) => event.payload as ResultUpdatedPayload,
    );
    const first = payloads[0];
    const topics = new Set<string>([`match:${first.competitionId}`]);

    for (const payload of payloads) {
      for (const uniqueIndex of payload.playerUniqueIndexes || []) {
        if (uniqueIndex) topics.add(`player:${uniqueIndex}`);
      }
      for (const clubId of payload.clubIds || []) {
        if (clubId) topics.add(`club:${clubId}`);
      }
    }

    const devicesByLocale = await this.fcm.getDevicesByTopicsGroupedByLocale(
      [...topics],
      NotificationType.MATCH,
    );
    const competitionName = first.competitionName || first.competitionId;

    for (const [locale, tokens] of Object.entries(devicesByLocale)) {
      const content = this.content.results(locale, competitionName);
      await this.fcm.sendNotification({
        ...content,
        notificationType: NotificationType.MATCH,
        targetDeviceTokens: tokens,
        data: {
          eventType: 'resultsUpdated',
          matchId: first.competitionId,
          competitionId: first.competitionId,
          resultIds: payloads.map((payload) => payload.resultId).join(','),
        },
      });
    }
  }

  private toStringData(
    data: Record<string, string | number | null | undefined>,
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([, value]) => value != null)
        .map(([key, value]) => [key, String(value)]),
    );
  }
}
