import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@app/common';
import { AuthService } from './auth.service';

const legacyHash = (password: string): string =>
  Buffer.from(createHash('sha256').update(password).digest('hex')).toString(
    'base64',
  );

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    aPIConsumer: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      aPIConsumer: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('accepts a matching bcrypt password without rehashing', async () => {
    const password = 's3cret';
    const hash = await bcrypt.hash(password, 10);
    prisma.aPIConsumer.findUnique.mockResolvedValue({
      id: 1,
      app: 'my-app',
      password: hash,
    });

    const result = await service.findOne('my-app', password);

    expect(result).toBe('my-app');
    expect(prisma.aPIConsumer.findUnique).toHaveBeenCalledWith({
      where: { app: 'my-app' },
    });
    expect(prisma.aPIConsumer.update).not.toHaveBeenCalled();
  });

  it('accepts a matching legacy sha256 password and rehashes it with bcrypt', async () => {
    const password = 'legacy-pass';
    prisma.aPIConsumer.findUnique.mockResolvedValue({
      id: 2,
      app: 'legacy-app',
      password: legacyHash(password),
    });

    const result = await service.findOne('legacy-app', password);

    expect(result).toBe('legacy-app');
    expect(prisma.aPIConsumer.update).toHaveBeenCalledTimes(1);

    const updateArg = prisma.aPIConsumer.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ app: 'legacy-app' });
    // The stored value is migrated to a real bcrypt hash of the password.
    expect(updateArg.data.password).toMatch(/^\$2[aby]\$/);
    await expect(
      bcrypt.compare(password, updateArg.data.password),
    ).resolves.toBe(true);
  });

  it('rejects a wrong password (bcrypt) without rehashing', async () => {
    const hash = await bcrypt.hash('right-password', 10);
    prisma.aPIConsumer.findUnique.mockResolvedValue({
      id: 3,
      app: 'my-app',
      password: hash,
    });

    const result = await service.findOne('my-app', 'wrong-password');

    expect(result).toBeUndefined();
    expect(prisma.aPIConsumer.update).not.toHaveBeenCalled();
  });

  it('rejects a wrong password (legacy) without rehashing', async () => {
    prisma.aPIConsumer.findUnique.mockResolvedValue({
      id: 4,
      app: 'legacy-app',
      password: legacyHash('right-password'),
    });

    const result = await service.findOne('legacy-app', 'wrong-password');

    expect(result).toBeUndefined();
    expect(prisma.aPIConsumer.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown app', async () => {
    prisma.aPIConsumer.findUnique.mockResolvedValue(null);

    const result = await service.findOne('does-not-exist', 'whatever');

    expect(result).toBeUndefined();
    expect(prisma.aPIConsumer.update).not.toHaveBeenCalled();
  });
});
