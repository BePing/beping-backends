import { UnauthorizedException } from '@nestjs/common';
import { CaptainJwtGuard } from './captain-jwt.guard';

describe('CaptainJwtGuard', () => {
  const tokens = { verifyAccess: jest.fn() };
  const request = { headers: {} as Record<string, string>, captain: undefined };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  };
  let guard: CaptainJwtGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    request.headers = {};
    request.captain = undefined;
    guard = new CaptainJwtGuard(tokens as any);
  });

  it('requires a complete bearer token', async () => {
    await expect(guard.canActivate(context as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    request.headers.authorization = 'Basic token';
    await expect(guard.canActivate(context as any)).rejects.toThrow(
      'Missing bearer token',
    );
    request.headers.authorization = 'Bearer';
    await expect(guard.canActivate(context as any)).rejects.toThrow(
      'Missing bearer token',
    );
  });

  it('attaches verified claims and rejects expired tokens', async () => {
    request.headers.authorization = 'Bearer valid';
    tokens.verifyAccess.mockResolvedValue({ sub: 1, club: 'C1' });
    await expect(guard.canActivate(context as any)).resolves.toBe(true);
    expect(request.captain).toEqual({ uniqueIndex: 1, clubIndex: 'C1' });

    request.headers.authorization = 'Bearer expired';
    tokens.verifyAccess.mockRejectedValue(new Error('expired'));
    await expect(guard.canActivate(context as any)).rejects.toThrow(
      'Invalid or expired token',
    );
  });
});
