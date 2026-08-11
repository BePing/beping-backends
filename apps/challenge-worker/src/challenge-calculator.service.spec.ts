import { ChallengeCalculatorService } from './challenge-calculator.service';

describe('ChallengeCalculatorService', () => {
  const prisma = {
    challengeSeason: { findUniqueOrThrow: jest.fn() },
  };
  const service = new ChallengeCalculatorService(prisma as never);

  beforeEach(() => {
    jest.restoreAllMocks();
    prisma.challengeSeason.findUniqueOrThrow.mockResolvedValue(seasonConfig());
  });

  it('includes eligible zero-point players and keeps exclusions effective', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      response([
        match([
          { uniqueIndex: 101, firstName: 'Alice', lastName: 'Zéro' },
          { uniqueIndex: 999, firstName: 'Exclu', lastName: 'Manuel' },
        ]),
      ]),
    );

    const result = await service.calculate('season-27', 4);

    expect(result.rankings).toEqual([
      expect.objectContaining({
        playerUniqueIndex: 101,
        points: 0,
        count0Pts: 1,
        position: 1,
        totalParticipants: 1,
        regionCode: 'LIEGE',
        levelCode: 'P1',
      }),
    ]);
    expect(result.points).toHaveLength(1);
  });

  it('blocks the whole publication input when a licence is not canonical', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      response([
        match([
          {
            uniqueIndex: Number.NaN,
            firstName: 'Identité',
            lastName: 'Invalide',
          },
        ]),
      ]),
    );

    await expect(service.calculate('season-27', 4)).rejects.toThrow(
      'Unnormalizable player identity',
    );
  });
});

function seasonConfig() {
  return {
    season: 27,
    challenge: { secretReferences: [] },
    regions: [{ id: 'region', code: 'LIEGE', label: 'Liège' }],
    clubs: [
      {
        clubIndex: 'L001',
        clubName: 'Club test',
        region: { code: 'LIEGE', label: 'Liège' },
      },
    ],
    levels: [{ id: 'level', code: 'P1', label: 'Provincial 1' }],
    divisions: [
      {
        divisionId: 1234,
        level: { code: 'P1', label: 'Provincial 1' },
      },
    ],
    excludedPlayers: [{ playerUniqueIndex: 999 }],
    pointOverrides: [],
    rules: [{ key: 'points', value: { pointsPerWin: 1, pointsForFour: 5 } }],
  };
}

function match(players: Array<Record<string, unknown>>) {
  return {
    matchId: 'L001-1',
    matchUniqueId: 5001,
    weekName: '4',
    divisionId: 1234,
    homeClub: 'L001',
    awayClub: 'L999',
    isHomeForfeited: false,
    isAwayForfeited: false,
    isHomeWithdrawn: false,
    isAwayWithdrawn: false,
    matchDetails: {
      detailsCreated: true,
      homePlayers: { players },
      awayPlayers: { players: [] },
      individualMatchResults: [],
    },
  };
}

function response(payload: unknown): Response {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue(payload),
  } as unknown as Response;
}
