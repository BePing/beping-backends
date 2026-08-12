import { PostHogService, PrismaService } from '@app/common';
import { FcmService } from './fcm.service';
import { NotificationContentService } from './notification-content.service';
import { NotificationOutboxService } from './notification-outbox.service';

const rankingEvent = {
  id: 'ranking_event',
  type: 'PLAYER_RANKING_UPDATED',
  attempts: 1,
  payload: {
    uniqueIndex: 100671,
    playerCategory: 'SENIOR_MEN',
    effectiveDate: '2025-12-01',
    oldPoints: 454.5,
    newPoints: 475,
    oldRankingEstimation: 'B2',
    newRankingEstimation: 'B0',
  },
};

const challengeEvent = {
  id: 'challenge_event',
  type: 'CHALLENGE_PUBLISHED',
  attempts: 1,
  payload: {
    challengeSlug: 'challenge-provincial',
    challengeName: 'Challenge provincial',
    season: 27,
    week: 4,
    publishedAt: '2026-10-08T06:00:00.000Z',
    publicationUrl:
      'https://challenges.beping.be/challenges/challenge-provincial',
  },
};

describe('NotificationOutboxService', () => {
  function setup(
    sendNotification = jest.fn().mockResolvedValue(undefined),
    events: Array<typeof rankingEvent | typeof challengeEvent> = [rankingEvent],
  ) {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue(events),
      notificationOutbox: { updateMany, update },
    } as unknown as PrismaService;
    const fcm = {
      getDevicesByTopicsGroupedByLocale: jest
        .fn()
        .mockResolvedValue({ fr: ['device-token'] }),
      getDevicesGroupedByLocale: jest
        .fn()
        .mockResolvedValue({ fr: ['challenge-device'] }),
      sendNotification,
    } as unknown as FcmService;
    const posthog = { capture: jest.fn() };
    const service = new NotificationOutboxService(
      prisma,
      fcm,
      new NotificationContentService(),
      posthog as unknown as PostHogService,
    );
    return { service, updateMany, update, sendNotification, posthog, fcm };
  }

  it('marks a claimed event as processed after delivery', async () => {
    const { service, updateMany, sendNotification, posthog } = setup();

    await service.processPendingEvents();

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Classement mis à jour',
        targetDeviceTokens: ['device-token'],
      }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['ranking_event'] } },
        data: expect.objectContaining({ status: 'PROCESSED' }),
      }),
    );
    expect(posthog.capture).toHaveBeenCalledWith(
      'notification_outbox_group_completed',
      'service:app-notifications',
      expect.objectContaining({
        outbox_event_type: 'PLAYER_RANKING_UPDATED',
        outcome: 'processed',
        event_count: 1,
        max_attempt_count: 1,
      }),
    );
  });

  it('requeues an event with backoff when FCM fails', async () => {
    const failure = jest.fn().mockRejectedValue(new Error('FCM unavailable'));
    const { service, update, posthog } = setup(failure);

    await service.processPendingEvents();

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ranking_event' },
        data: expect.objectContaining({
          status: 'PENDING',
          lastError: 'FCM unavailable',
        }),
      }),
    );
    expect(posthog.capture).toHaveBeenCalledWith(
      'notification_outbox_group_completed',
      'service:app-notifications',
      expect.objectContaining({ outcome: 'retry_scheduled' }),
    );
  });

  it('delivers a published challenge only to challenge-opted-in devices', async () => {
    const sendNotification = jest.fn().mockResolvedValue(undefined);
    const { service, updateMany, fcm } = setup(sendNotification, [
      challengeEvent,
    ]);

    await service.processPendingEvents();

    expect(fcm.getDevicesGroupedByLocale).toHaveBeenCalledWith('CHALLENGE');
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Nouveau classement communautaire',
        notificationType: 'CHALLENGE',
        targetDeviceTokens: ['challenge-device'],
        data: expect.objectContaining({
          eventType: 'challengePublished',
          challengeSlug: 'challenge-provincial',
          week: '4',
          publicationUrl:
            'https://challenges.beping.be/challenges/challenge-provincial',
        }),
      }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['challenge_event'] } },
      }),
    );
  });
});
