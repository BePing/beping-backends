import { ServiceUnavailableException } from '@nestjs/common';
import { getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { NotificationType, PrismaService } from '@app/common';
import { FcmService } from './fcm.service';
import { notificationMetrics } from './notification-metrics';

jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(),
  initializeApp: jest.fn(),
  cert: jest.fn(),
}));
jest.mock('firebase-admin/messaging', () => ({ getMessaging: jest.fn() }));

describe('FcmService dispatch', () => {
  const prisma = {
    deviceSubscription: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    notificationLog: { createMany: jest.fn() },
    topicSubscription: { findMany: jest.fn() },
  };
  const sendEachForMulticast = jest.fn();
  let service: FcmService;

  beforeEach(() => {
    jest.clearAllMocks();
    (getApps as jest.Mock).mockReturnValue([{}]);
    (getMessaging as jest.Mock).mockReturnValue({ sendEachForMulticast });
    prisma.deviceSubscription.findMany.mockResolvedValue([
      { id: 'subscription-1', deviceToken: 'token-valid-1234567890' },
      { id: 'subscription-2', deviceToken: 'token-invalid-1234567890' },
    ]);
    prisma.deviceSubscription.updateMany.mockResolvedValue({ count: 1 });
    prisma.notificationLog.createMany.mockResolvedValue({ count: 2 });
    service = new FcmService(prisma as never);
  });

  it('aggregates FCM results and persists logs in bulk', async () => {
    sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true, messageId: 'message-1' },
        {
          success: false,
          error: {
            code: 'messaging/registration-token-not-registered',
            message: 'invalid token',
          },
        },
      ],
    });

    await expect(
      service.sendNotification({
        title: 'Title',
        body: 'Body',
        notificationType: NotificationType.MATCH,
        targetDeviceTokens: [
          'token-valid-1234567890',
          'token-invalid-1234567890',
        ],
      }),
    ).resolves.toEqual({
      targeted: 2,
      successCount: 1,
      failureCount: 1,
      skipped: false,
    });

    expect(prisma.notificationLog.createMany).toHaveBeenCalledTimes(1);
    expect(
      prisma.notificationLog.createMany.mock.calls[0][0].data,
    ).toHaveLength(2);
    expect(prisma.deviceSubscription.updateMany).toHaveBeenCalledWith({
      where: { deviceToken: { in: ['token-invalid-1234567890'] } },
      data: { active: false },
    });
  });

  it('returns a service error when every FCM target fails', async () => {
    sendEachForMulticast.mockRejectedValue(new Error('FCM unavailable'));

    await expect(
      service.sendNotification({
        title: 'Title',
        body: 'Body',
        notificationType: NotificationType.MATCH,
        targetDeviceTokens: ['token-valid-1234567890'],
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.notificationLog.createMany).toHaveBeenCalledTimes(1);
  });

  it('keeps the FCM aggregate when invalid-token persistence fails', async () => {
    const metricsSpy = jest.spyOn(notificationMetrics, 'recordDeliveries');
    prisma.deviceSubscription.updateMany.mockRejectedValue(
      new Error('database unavailable'),
    );
    sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true, messageId: 'message-1' },
        {
          success: false,
          error: {
            code: 'messaging/invalid-registration-token',
            message: 'invalid token',
          },
        },
      ],
    });

    await expect(
      service.sendNotification({
        title: 'Title',
        body: 'Body',
        notificationType: NotificationType.MATCH,
        targetDeviceTokens: [
          'token-valid-1234567890',
          'token-invalid-1234567890',
        ],
      }),
    ).resolves.toMatchObject({ successCount: 1, failureCount: 1 });
    expect(metricsSpy).toHaveBeenCalledWith(NotificationType.MATCH, 'sent', 1);
    expect(metricsSpy).toHaveBeenCalledWith(
      NotificationType.MATCH,
      'failed',
      1,
    );
  });

  it('fails explicitly when Firebase is not initialized', async () => {
    (getApps as jest.Mock).mockReturnValue([]);

    await expect(
      service.sendNotification({
        title: 'Title',
        body: 'Body',
        notificationType: NotificationType.MATCH,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('FcmService topic lookup', () => {
  it('deduplicates devices subscribed through several matching topics', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        deviceSubscription: { deviceToken: 'token-1', locale: 'fr' },
      },
      {
        deviceSubscription: { deviceToken: 'token-1', locale: 'fr' },
      },
      {
        deviceSubscription: { deviceToken: 'token-2', locale: 'nl' },
      },
    ]);
    const prisma = {
      topicSubscription: { findMany },
    } as unknown as PrismaService;
    const service = new FcmService(prisma);

    await expect(
      service.getDevicesByTopicsGroupedByLocale(
        ['match:PANTH01/003', 'player:100671', 'match:PANTH01/003'],
        NotificationType.MATCH,
      ),
    ).resolves.toEqual({ fr: ['token-1'], nl: ['token-2'] });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          topic: {
            in: ['match:PANTH01/003', 'player:100671'],
          },
          deviceSubscription: {
            active: true,
            notificationTypes: { has: NotificationType.MATCH },
          },
        },
      }),
    );
  });
});
