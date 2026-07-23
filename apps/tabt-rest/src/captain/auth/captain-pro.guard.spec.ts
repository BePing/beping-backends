import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { CaptainProGuard } from './captain-pro.guard';

function context(headers: Record<string, string>): any {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  };
}

describe('CaptainProGuard', () => {
  const http = { get: jest.fn() };
  const values: Record<string, string> = {
    REVENUECAT_SECRET_API_KEY: 'secret',
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete values.REVENUECAT_ENTITLEMENT_ID;
  });

  it('does not trust the legacy client Pro header', async () => {
    const guard = new CaptainProGuard(
      http as unknown as HttpService,
      config as unknown as ConfigService,
    );
    await expect(
      guard.canActivate(context({ 'x-beping-pro': 'true' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(http.get).not.toHaveBeenCalled();
  });

  it('accepts an active server-verified entitlement', async () => {
    http.get.mockReturnValue(
      of({
        data: {
          subscriber: {
            entitlements: {
              pro: {
                expires_date: new Date(Date.now() + 60_000).toISOString(),
              },
            },
          },
        },
      }),
    );
    const guard = new CaptainProGuard(
      http as unknown as HttpService,
      config as unknown as ConfigService,
    );

    await expect(
      guard.canActivate(
        context({ 'x-revenuecat-app-user-id': 'anonymous-user' }),
      ),
    ).resolves.toBe(true);
    expect(http.get).toHaveBeenCalledWith(
      expect.stringContaining('anonymous-user'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret',
        }),
      }),
    );
  });

  it('fails closed for expired entitlements and upstream errors', async () => {
    http.get.mockReturnValueOnce(
      of({
        data: {
          subscriber: {
            entitlements: {
              pro: { expires_date: '2020-01-01T00:00:00Z' },
            },
          },
        },
      }),
    );
    const expiredGuard = new CaptainProGuard(
      http as unknown as HttpService,
      config as unknown as ConfigService,
    );
    await expect(
      expiredGuard.canActivate(
        context({ 'x-revenuecat-app-user-id': 'expired-user' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    http.get.mockReturnValueOnce(throwError(() => new Error('offline')));
    const offlineGuard = new CaptainProGuard(
      http as unknown as HttpService,
      config as unknown as ConfigService,
    );
    await expect(
      offlineGuard.canActivate(
        context({ 'x-revenuecat-app-user-id': 'offline-user' }),
      ),
    ).rejects.toThrow('Pro verification unavailable');
  });
});
