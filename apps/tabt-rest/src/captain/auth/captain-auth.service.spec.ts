import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaptainAuthService } from './captain-auth.service';

describe('CaptainAuthService', () => {
  const tabt = {
    TestAsync: jest.fn(),
    GetMembersAsync: jest.fn(),
  };
  const prisma = {
    captainAccount: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const tokens = {
    signAccess: jest.fn(),
    signRefresh: jest.fn(),
    verifyRefresh: jest.fn(),
  };
  const config = {
    get: jest.fn(),
  };
  let service: CaptainAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    tabt.TestAsync.mockResolvedValue([{ IsValidAccount: true }]);
    tabt.GetMembersAsync.mockResolvedValue([
      {
        MemberEntries: [
          {
            UniqueIndex: 123,
            Club: 'C1',
            FirstName: 'Ada',
            LastName: 'Lovelace',
            Ranking: 'B4',
          },
        ],
      },
    ]);
    tokens.signAccess.mockResolvedValue('access');
    tokens.signRefresh.mockResolvedValue('refresh');
    service = new CaptainAuthService(
      tabt as any,
      config as unknown as ConfigService,
      prisma as any,
      tokens as any,
    );
  });

  it('rejects a valid federation login when the captain is not provisioned', async () => {
    prisma.captainAccount.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        account: 'federation-user',
        password: 'secret',
        claimedUniqueIndex: 999,
      }),
    ).rejects.toThrow('Captain access is not enabled');
    expect(tabt.GetMembersAsync).not.toHaveBeenCalled();
    expect(tokens.signAccess).not.toHaveBeenCalled();
  });

  it('issues a session only for the pre-provisioned matching identity and club', async () => {
    prisma.captainAccount.findUnique.mockResolvedValue({
      uniqueIndex: 123,
      clubIndex: 'C1',
    });
    prisma.captainAccount.update.mockResolvedValue({});

    await expect(
      service.login({
        account: 'federation-user',
        password: 'secret',
        claimedUniqueIndex: 123,
      }),
    ).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      member: expect.objectContaining({
        uniqueIndex: 123,
        clubIndex: 'C1',
      }),
    });
    expect(prisma.captainAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { uniqueIndex: 123 } }),
    );
  });

  it('rejects club changes instead of transferring captain authority', async () => {
    prisma.captainAccount.findUnique.mockResolvedValue({
      uniqueIndex: 123,
      clubIndex: 'OTHER',
    });

    await expect(
      service.login({
        account: 'federation-user',
        password: 'secret',
        claimedUniqueIndex: 123,
      }),
    ).rejects.toThrow('Captain identity does not match');
    expect(prisma.captainAccount.update).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials before consulting provisioned identities', async () => {
    tabt.TestAsync.mockResolvedValue([{ IsValidAccount: false }]);

    await expect(
      service.login({
        account: 'bad',
        password: 'bad',
        claimedUniqueIndex: 123,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.captainAccount.findUnique).not.toHaveBeenCalled();
  });

  it('rotates a valid refresh token and rejects deleted accounts', async () => {
    tokens.verifyRefresh.mockResolvedValue({ sub: 123, club: 'C1' });
    prisma.captainAccount.findUnique.mockResolvedValueOnce(null);
    await expect(service.refresh('refresh')).rejects.toThrow(
      'Captain account no longer exists',
    );

    prisma.captainAccount.findUnique.mockResolvedValueOnce({
      uniqueIndex: 123,
      clubIndex: 'C1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      ranking: 'B4',
    });
    await expect(service.refresh('refresh')).resolves.toEqual(
      expect.objectContaining({
        accessToken: 'access',
        refreshToken: 'refresh',
      }),
    );
  });
});
