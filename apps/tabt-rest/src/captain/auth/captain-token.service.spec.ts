import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CaptainTokenService } from './captain-token.service';

describe('CaptainTokenService', () => {
  const values: Record<string, string> = {
    CAPTAIN_JWT_SECRET: 'a'.repeat(32),
    CAPTAIN_JWT_REFRESH_SECRET: 'b'.repeat(32),
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  };
  const jwt = new JwtService();
  let service: CaptainTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CaptainTokenService(jwt, config as unknown as ConfigService);
  });

  it('round-trips access and refresh tokens with distinct token types', async () => {
    const access = await service.signAccess(123, 'C1');
    const refresh = await service.signRefresh(123, 'C1');

    await expect(service.verifyAccess(access)).resolves.toEqual(
      expect.objectContaining({ sub: 123, club: 'C1', typ: 'access' }),
    );
    await expect(service.verifyRefresh(refresh)).resolves.toEqual(
      expect.objectContaining({ sub: 123, club: 'C1', typ: 'refresh' }),
    );
    await expect(service.verifyAccess(refresh)).rejects.toThrow();
    await expect(service.verifyRefresh(access)).rejects.toThrow();
  });

  it('scopes response tokens and rejects them as captain access tokens', async () => {
    const response = await service.signResponseToken({
      resourceId: 'poll-id',
      matchUniqueId: 42,
      uniqueIndex: 123,
      purpose: 'availability',
    });

    await expect(service.verifyResponseToken(response)).resolves.toEqual(
      expect.objectContaining({
        resourceId: 'poll-id',
        matchUniqueId: 42,
        uniqueIndex: 123,
        purpose: 'availability',
        typ: 'response',
      }),
    );
    await expect(service.verifyAccess(response)).rejects.toThrow(
      'Invalid access token type',
    );
  });
});
