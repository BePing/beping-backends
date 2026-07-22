import { ServiceUnavailableException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';

jest.mock('firebase-admin/app-check', () => ({ getAppCheck: jest.fn() }));

describe('NotificationsController health', () => {
  const fcmService = {
    countActiveSubscriptions: jest.fn(),
    isFirebaseAvailable: jest.fn(),
  };
  const controller = new NotificationsController(fcmService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    fcmService.isFirebaseAvailable.mockReturnValue(true);
  });

  it('uses a database count instead of loading subscriptions', async () => {
    fcmService.countActiveSubscriptions.mockResolvedValue(42);

    await expect(controller.healthCheck()).resolves.toMatchObject({
      status: 'healthy',
      activeSubscriptions: 42,
    });
  });

  it('returns 503 when the database count fails', async () => {
    fcmService.countActiveSubscriptions.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(controller.healthCheck()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns 503 when Firebase cannot send notifications', async () => {
    fcmService.isFirebaseAvailable.mockReturnValue(false);

    await expect(controller.healthCheck()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fcmService.countActiveSubscriptions).not.toHaveBeenCalled();
  });
});
