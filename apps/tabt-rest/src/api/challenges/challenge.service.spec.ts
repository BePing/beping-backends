import { ChallengeService } from './challenge.service';
import { PrismaService } from '@app/common';

describe('ChallengeService', () => {
  const prisma = {
    challenge: { findMany: jest.fn(), findFirst: jest.fn() },
    challengeSeason: { findMany: jest.fn() },
    challengePublication: { findFirst: jest.fn(), findMany: jest.fn() },
    challengeRanking: { findMany: jest.fn() },
    challengeRegionSummary: { findUnique: jest.fn() },
  };
  const service = new ChallengeService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('keeps the current Thursday visible until its configured Brussels time', async () => {
    prisma.challenge.findMany.mockResolvedValue([
      {
        slug: 'provincial',
        name: 'Challenge provincial',
        shortName: null,
        description: null,
        unofficial: true,
        unofficialLabel: 'Classement non officiel',
        displayOrder: 0,
        seasons: [
          {
            season: 27,
            thursdayPublishTime: '08:00',
            regions: [],
            levels: [],
            championshipWeeks: [
              { thursdayPublishDate: new Date('2026-10-08T00:00:00Z') },
              { thursdayPublishDate: new Date('2026-10-15T00:00:00Z') },
            ],
          },
        ],
      },
    ]);

    const before = await service.listActiveChallenges(
      new Date('2026-10-08T05:59:00Z'),
    );
    const after = await service.listActiveChallenges(
      new Date('2026-10-08T06:01:00Z'),
    );

    expect(before[0].nextPublicationAt).toEqual(
      new Date('2026-10-08T06:00:00Z'),
    );
    expect(after[0].nextPublicationAt).toEqual(
      new Date('2026-10-15T06:00:00Z'),
    );
  });

  it('returns an empty page when no Thursday publication exists', async () => {
    prisma.challenge.findFirst.mockResolvedValue({
      slug: 'provincial',
      name: 'Challenge provincial',
      unofficial: true,
      unofficialLabel: 'Classement non officiel',
      seasons: [{ id: 'season-27', season: 27 }],
    });
    prisma.challengePublication.findFirst.mockResolvedValue(null);

    await expect(
      service.getRankings('provincial', { limit: 50 }),
    ).resolves.toEqual({ items: [] });
    expect(prisma.challengeRanking.findMany).not.toHaveBeenCalled();
  });

  it('only exposes the latest publication per active challenge season', async () => {
    prisma.challengeSeason.findMany.mockResolvedValue([
      {
        id: 'season-27',
        season: 27,
        challenge: {
          slug: 'provincial',
          name: 'Challenge provincial',
          unofficial: true,
          unofficialLabel: 'Classement non officiel',
        },
      },
    ]);
    prisma.challengePublication.findMany.mockResolvedValue([
      {
        id: 'publication-4',
        seasonId: 'season-27',
        runId: 'monday-run-4',
        publishedAt: new Date('2026-10-08T06:00:00Z'),
        championshipWeek: { week: 4 },
        run: { checksum: 'checksum-4', totalPlayers: 124 },
      },
      {
        id: 'publication-3',
        seasonId: 'season-27',
        runId: 'monday-run-3',
        publishedAt: new Date('2026-10-01T06:00:00Z'),
        championshipWeek: { week: 3 },
        run: { checksum: 'checksum-3', totalPlayers: 120 },
      },
    ]);
    prisma.challengeRanking.findMany.mockResolvedValue([
      {
        runId: 'monday-run-4',
        playerUniqueIndex: 123456,
        playerName: 'Alice Dupont',
        clubIndex: 'L123',
        clubName: 'Club test',
        regionCode: 'LIEGE',
        regionLabel: 'Liège',
        levelCode: 'P2',
        levelLabel: 'Provincial 2',
        position: 37,
        totalParticipants: 124,
        points: 12,
        count5Pts: 1,
        count3Pts: 1,
        count2Pts: 1,
        count1Pts: 2,
        count0Pts: 1,
      },
    ]);

    const result = await service.getMemberChallengeRankings(123456);

    expect(prisma.challengeRanking.findMany).toHaveBeenCalledWith({
      where: {
        playerUniqueIndex: 123456,
        runId: { in: ['monday-run-4'] },
      },
    });
    expect(result).toEqual([
      expect.objectContaining({
        challengeSlug: 'provincial',
        week: 4,
        position: 37,
        points: 12,
      }),
    ]);
  });

  it('treats a player without a published ranking as a normal empty result', async () => {
    prisma.challenge.findFirst.mockResolvedValue({
      slug: 'provincial',
      name: 'Challenge provincial',
      unofficial: true,
      unofficialLabel: 'Classement non officiel',
      seasons: [{ id: 'season-27', season: 27 }],
    });
    prisma.challengePublication.findMany.mockResolvedValue([]);

    await expect(
      service.getChallengePlayerRankings('provincial', 999999, {}),
    ).resolves.toEqual({ hasRanking: false, rankings: [], points: [] });
  });

  it('paginates and searches only inside the published Monday run', async () => {
    prisma.challenge.findFirst.mockResolvedValue({
      slug: 'provincial',
      name: 'Challenge provincial',
      unofficial: true,
      unofficialLabel: 'Classement non officiel',
      seasons: [{ id: 'season-27', season: 27 }],
    });
    prisma.challengePublication.findFirst.mockResolvedValue({
      seasonId: 'season-27',
      runId: 'published-monday-run',
      publishedAt: new Date('2026-10-08T06:00:00Z'),
      championshipWeek: { week: 4 },
      run: { checksum: 'verified', totalPlayers: 124 },
    });
    prisma.challengeRanking.findMany.mockResolvedValue([
      ranking('rank-1', 101, 1),
      ranking('rank-2', 102, 2),
    ]);

    const result = await service.getRankings('provincial', {
      limit: 1,
      search: 'Alice',
      region: 'LIEGE',
      level: 'P2',
    });

    expect(prisma.challengeRanking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          runId: 'published-monday-run',
          regionCode: 'LIEGE',
          levelCode: 'P2',
          OR: expect.arrayContaining([
            { playerName: { contains: 'Alice', mode: 'insensitive' } },
          ]),
        }),
        take: 2,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe('rank-1');
  });
});

function ranking(id: string, playerUniqueIndex: number, position: number) {
  return {
    id,
    runId: 'published-monday-run',
    playerUniqueIndex,
    playerName: `Alice ${playerUniqueIndex}`,
    clubIndex: 'L123',
    clubName: 'Club test',
    regionCode: 'LIEGE',
    regionLabel: 'Liège',
    levelCode: 'P2',
    levelLabel: 'Provincial 2',
    position,
    totalParticipants: 124,
    points: 12,
    count5Pts: 1,
    count3Pts: 1,
    count2Pts: 1,
    count1Pts: 2,
    count0Pts: 1,
  };
}
