import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

const getAppsMock = jest.fn();
const verifyTokenMock = jest.fn();

jest.mock('firebase-admin/app', () => ({
  getApps: () => getAppsMock(),
}));
jest.mock('firebase-admin/app-check', () => ({
  getAppCheck: () => ({ verifyToken: verifyTokenMock }),
}));

// Imported after the mocks so the guard picks up the mocked firebase modules.
import { AppCheckGuard } from './app-check.guard';

describe('AppCheckGuard', () => {
  let guard: AppCheckGuard;
  const originalNodeEnv = process.env.NODE_ENV;

  const buildContext = (headers: Record<string, string> = {}) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new AppCheckGuard();
    getAppsMock.mockReset();
    verifyTokenMock.mockReset();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('fails closed (denies) when Firebase is not initialized in production', async () => {
    process.env.NODE_ENV = 'production';
    getAppsMock.mockReturnValue([]);

    await expect(guard.canActivate(buildContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows when Firebase is not initialized outside production', async () => {
    process.env.NODE_ENV = 'development';
    getAppsMock.mockReturnValue([]);

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });

  it('rejects a missing App Check token when Firebase is initialized', async () => {
    process.env.NODE_ENV = 'production';
    getAppsMock.mockReturnValue([{}]);

    await expect(guard.canActivate(buildContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('verifies a present App Check token when Firebase is initialized', async () => {
    process.env.NODE_ENV = 'production';
    getAppsMock.mockReturnValue([{}]);
    verifyTokenMock.mockResolvedValue({ appId: 'app-id' });

    const result = await guard.canActivate(
      buildContext({ 'x-firebase-appcheck': 'a-token' }),
    );

    expect(result).toBe(true);
    expect(verifyTokenMock).toHaveBeenCalledWith('a-token');
  });
});
