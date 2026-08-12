import { computeRankingChecksum } from './challenge-checksum';
import { ChallengeOrchestratorService } from './challenge-orchestrator.service';
import { ComputedRanking } from './challenge-worker.types';

const mockLockQuery = jest
  .fn()
  .mockResolvedValue({ rows: [{ acquired: true }] });
const mockLockRelease = jest.fn();
const mockLockEnd = jest.fn();

jest.mock('pg', () => ({
  ...jest.requireActual('pg'),
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: mockLockQuery,
      release: mockLockRelease,
    }),
    end: mockLockEnd,
  })),
}));

describe('ChallengeOrchestratorService', () => {
  const prisma = {
    challengeChampionshipWeek: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    challengeRun: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    challengePublication: { upsert: jest.fn() },
    notificationOutbox: { upsert: jest.fn() },
    $transaction: jest.fn(),
  };
  const calculator = { calculate: jest.fn() };
  const press = { send: jest.fn() };
  const validator = { assertSeasonValid: jest.fn() };
  const posthog = { capture: jest.fn(), captureException: jest.fn() };

  let service: ChallengeOrchestratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLockQuery.mockResolvedValue({ rows: [{ acquired: true }] });
    prisma.$transaction.mockImplementation(async (operation) =>
      Array.isArray(operation) ? Promise.all(operation) : operation(prisma),
    );
    service = new ChallengeOrchestratorService(
      prisma as never,
      calculator as never,
      press as never,
      validator as never,
      posthog as never,
    );
  });

  it('skips a calendar date without a championship week', async () => {
    prisma.challengeChampionshipWeek.findMany.mockResolvedValue([]);

    await expect(service.run('sunday', '2026-10-11')).resolves.toEqual([
      { status: 'SKIPPED_NO_CHAMPIONSHIP_WEEK' },
    ]);
    expect(calculator.calculate).not.toHaveBeenCalled();
    expect(press.send).not.toHaveBeenCalled();
  });

  it('isolates challenges while failing the global job', async () => {
    prisma.challengeChampionshipWeek.findMany.mockResolvedValue([
      week('week-a', 'season-a', 'a'),
      week('week-b', 'season-b', 'b'),
    ]);
    validator.assertSeasonValid.mockImplementation((seasonId: string) =>
      seasonId === 'season-a'
        ? Promise.reject(new Error('invalid A'))
        : Promise.resolve(),
    );
    jest
      .spyOn(
        service as unknown as { publish(id: string): Promise<string> },
        'publish',
      )
      .mockResolvedValue('run-b');
    prisma.challengeRun.findUniqueOrThrow.mockResolvedValue({
      totalPlayers: 12,
      checksum: 'checksum-b',
      pressSentAt: new Date(),
      publishedAt: new Date(),
    });

    const result = await service.run('thursday', '2026-10-08');

    expect(result[0]).toMatchObject({
      status: 'FAILED',
      challengeSlug: 'a',
    });
    expect(result[1]).toMatchObject({
      status: 'SUCCESS',
      challengeSlug: 'b',
      runId: 'run-b',
      totalPlayers: 12,
      published: true,
    });
  });

  it('publishes exactly the checksum-verified Monday run and is idempotent', async () => {
    const ranking = sampleRanking();
    const checksum = computeRankingChecksum([ranking]);
    prisma.challengeChampionshipWeek.findUniqueOrThrow.mockResolvedValue({
      id: 'week-4',
      seasonId: 'season-27',
      week: 4,
      season: {
        season: 27,
        challenge: {
          slug: 'provincial',
          name: 'Challenge provincial',
          integrationConfig: {
            publicWebBaseUrl: 'https://challenges.beping.be',
          },
        },
      },
    });
    prisma.challengeRun.findFirst.mockResolvedValue({
      id: 'monday-run',
      status: 'PUBLISHED',
      checksum,
      rankings: [
        {
          id: 'ranking-1',
          runId: 'monday-run',
          createdAt: new Date(),
          ...ranking,
        },
      ],
    });

    await expect(
      (service as unknown as { publish(id: string): Promise<string> }).publish(
        'week-4',
      ),
    ).resolves.toBe('monday-run');

    expect(prisma.challengeRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          championshipWeekId: 'week-4',
          type: 'MONDAY_PRESS_FINAL',
          status: { in: ['READY_FOR_PUBLICATION', 'PUBLISHED'] },
          pressDelivery: { status: 'SENT' },
        }),
      }),
    );
    expect(prisma.challengePublication.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ runId: 'monday-run' }),
        update: expect.objectContaining({ runId: 'monday-run' }),
      }),
    );
    expect(prisma.notificationOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deduplicationKey: 'challenge-published:provincial:27:4',
        },
        create: expect.objectContaining({
          payload: expect.objectContaining({
            publicationUrl:
              'https://challenges.beping.be/challenges/provincial',
          }),
        }),
      }),
    );
  });

  it('keeps the previous publication when Monday is not publishable', async () => {
    prisma.challengeChampionshipWeek.findUniqueOrThrow.mockResolvedValue({
      id: 'week-4',
      seasonId: 'season-27',
      week: 4,
      season: {
        season: 27,
        challenge: { slug: 'provincial', name: 'Challenge provincial' },
      },
    });
    prisma.challengeRun.findFirst.mockResolvedValue(null);

    await expect(
      (service as unknown as { publish(id: string): Promise<string> }).publish(
        'week-4',
      ),
    ).rejects.toThrow('No publishable Monday run');
    expect(prisma.challengePublication.upsert).not.toHaveBeenCalled();
  });

  it('does not resend press after an interrupted unconfirmed delivery', async () => {
    prisma.challengeChampionshipWeek.findUniqueOrThrow.mockResolvedValue({
      id: 'week-4',
      seasonId: 'season-27',
      week: 4,
    });
    prisma.challengeRun.findFirst.mockResolvedValue({
      id: 'uncertain-run',
      status: 'COMPUTED',
      pressDelivery: { status: 'PENDING' },
    });

    await expect(
      (
        service as unknown as {
          compute(id: string, type: 'MONDAY_PRESS_FINAL'): Promise<string>;
        }
      ).compute('week-4', 'MONDAY_PRESS_FINAL'),
    ).rejects.toThrow('manual resolution required');
    expect(calculator.calculate).not.toHaveBeenCalled();
    expect(press.send).not.toHaveBeenCalled();
  });
});

function week(id: string, seasonId: string, slug: string) {
  return {
    id,
    seasonId,
    week: 4,
    season: {
      season: 27,
      challenge: { slug, displayOrder: 0 },
    },
  };
}

function sampleRanking(): ComputedRanking {
  return {
    playerUniqueIndex: 123,
    playerName: 'Joueur Test',
    clubIndex: 'L001',
    clubName: 'Club Test',
    regionCode: 'LIEGE',
    regionLabel: 'Liège',
    levelCode: 'P2',
    levelLabel: 'Provincial 2',
    position: 1,
    totalParticipants: 1,
    points: 0,
    count5Pts: 0,
    count3Pts: 0,
    count2Pts: 0,
    count1Pts: 0,
    count0Pts: 1,
  };
}
