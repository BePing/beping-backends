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

describe('NotificationOutboxService', () => {
  function setup(sendNotification = jest.fn().mockResolvedValue(undefined)) {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([rankingEvent]),
      notificationOutbox: { updateMany, update },
    } as unknown as PrismaService;
    const fcm = {
      getDevicesByTopicsGroupedByLocale: jest
        .fn()
        .mockResolvedValue({ fr: ['device-token'] }),
      sendNotification,
    } as unknown as FcmService;
    const posthog = { capture: jest.fn() };
    const service = new NotificationOutboxService(
      prisma,
      fcm,
      new NotificationContentService(),
      posthog as unknown as PostHogService,
    );
    return { service, updateMany, update, sendNotification, posthog };
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
});
