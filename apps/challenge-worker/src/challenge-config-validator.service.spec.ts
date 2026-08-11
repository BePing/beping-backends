import { ChallengeConfigValidatorService } from './challenge-config-validator.service';

describe('ChallengeConfigValidatorService', () => {
  const prisma = {
    challengeSeason: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirstOrThrow: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    challenge: { update: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new ChallengeConfigValidatorService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REQUIRED_TEST_SECRET;
  });

  it('blocks activation when a level is unresolved or a secret is absent', async () => {
    prisma.challengeSeason.findFirstOrThrow.mockResolvedValue({
      id: 'season-27',
      challengeId: 'challenge',
    });
    prisma.challengeSeason.findUniqueOrThrow.mockResolvedValue(configuration());

    await expect(service.activateSeason('provincial', 27)).rejects.toThrow(
      'level P1 has no division',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();

    const result = await service.validateSeason('season-27');
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'level P1 has no division',
        'missing environment variable REQUIRED_TEST_SECRET',
      ]),
    );
  });
});

function configuration() {
  return {
    id: 'season-27',
    season: 27,
    timezone: 'Europe/Brussels',
    sundayRunTime: '18:00',
    mondayRunTime: '20:00',
    thursdayPublishTime: '08:00',
    pressRankingLimit: 6,
    startsOn: new Date('2026-07-01T00:00:00Z'),
    endsOn: new Date('2027-06-30T00:00:00Z'),
    challenge: {
      slug: 'provincial',
      secretReferences: [
        {
          required: true,
          envVarName: 'REQUIRED_TEST_SECRET',
        },
      ],
    },
    regions: [{ id: 'region', code: 'LIEGE' }],
    clubs: [{ regionId: 'region' }],
    levels: [{ id: 'level', code: 'P1' }],
    divisions: [],
    rules: [{ key: 'points', value: { pointsPerWin: 1, pointsForFour: 5 } }],
    pressRecipients: [{ email: 'press@example.test' }],
    championshipWeeks: [
      {
        week: 1,
        championshipSunday: new Date('2026-09-20T00:00:00Z'),
        mondayRunDate: new Date('2026-09-21T00:00:00Z'),
        thursdayPublishDate: new Date('2026-09-24T00:00:00Z'),
      },
    ],
  };
}
