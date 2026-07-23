import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { CaptainNotifierService } from './captain-notifier.service';

describe('CaptainNotifierService', () => {
  const http = { post: jest.fn() };
  const values: Record<string, string> = {
    NOTIFICATIONS_API_URL: 'https://notifications.test',
    NOTIFICATIONS_API_USER: 'captain',
    NOTIFICATIONS_API_PASSWORD: 'secret',
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  };
  let service: CaptainNotifierService;

  const notification = {
    type: 'CAPTAIN_AVAILABILITY_REQUEST' as const,
    title: 'Disponible ?',
    body: 'Réponds',
    targetUniqueIndex: 123,
    matchUniqueId: 42,
    deepLink: 'beping://captain/match/42/availability',
    responseToken: 'signed',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CaptainNotifierService(
      http as unknown as HttpService,
      config as unknown as ConfigService,
    );
  });

  it('sends the response capability only through the authenticated notification API', async () => {
    http.post.mockReturnValue(of({ data: { sent: true } }));

    await expect(service.send(notification)).resolves.toBe(true);
    expect(http.post).toHaveBeenCalledWith(
      'https://notifications.test/notifications/send',
      expect.objectContaining({
        targetUserId: '123',
        data: expect.objectContaining({ responseToken: 'signed' }),
      }),
      { auth: { username: 'captain', password: 'secret' } },
    );
  });

  it('fails safely when notification configuration or transport is unavailable', async () => {
    delete values.NOTIFICATIONS_API_PASSWORD;
    await expect(service.send(notification)).resolves.toBe(false);
    values.NOTIFICATIONS_API_PASSWORD = 'secret';

    http.post.mockReturnValue(throwError(() => new Error('offline')));
    await expect(service.send(notification)).resolves.toBe(false);
  });

  it('reports how many batch deliveries succeeded', async () => {
    jest
      .spyOn(service, 'send')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await expect(
      service.sendMany([
        notification,
        { ...notification, targetUniqueIndex: 456 },
      ]),
    ).resolves.toBe(1);
    await expect(service.sendMany([])).resolves.toBe(0);
  });
});
