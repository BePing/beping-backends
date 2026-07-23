import { AvailabilityStatus, ResponseSource } from '@app/common';
import { CaptainAvailabilityService } from './captain-availability.service';

describe('CaptainAvailabilityService', () => {
  const prisma = {
    availabilityPoll: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    availabilityResponse: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const roster = {
    getMatch: jest.fn(),
    getClubTeams: jest.fn(),
    getClubMembers: jest.fn(),
  };
  const tokens = {
    signResponseToken: jest.fn(),
    verifyResponseToken: jest.fn(),
  };
  const notifier = {
    sendMany: jest.fn(),
  };
  const captain = { uniqueIndex: 1, clubIndex: 'C1' };
  let service: CaptainAvailabilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CaptainAvailabilityService(
      prisma as any,
      roster as any,
      tokens as any,
      notifier as any,
    );
  });

  it('rejects anonymous or malformed player responses before database lookup', async () => {
    tokens.verifyResponseToken.mockRejectedValue(new Error('bad token'));

    await expect(
      service.submitResponse(42, {
        uniqueIndex: 123,
        status: AvailabilityStatus.PRESENT,
        responseToken: 'forged',
      }),
    ).rejects.toThrow('Invalid response token');
    expect(prisma.availabilityPoll.findUnique).not.toHaveBeenCalled();
  });

  it('updates only the rostered player identified by the scoped token', async () => {
    tokens.verifyResponseToken.mockResolvedValue({
      resourceId: 'poll-1',
      matchUniqueId: 42,
      uniqueIndex: 123,
      purpose: 'availability',
    });
    prisma.availabilityPoll.findUnique.mockResolvedValue({
      id: 'poll-1',
      matchUniqueId: 42,
      clubIndex: 'C1',
    });
    prisma.availabilityResponse.findUnique.mockResolvedValue({ id: 'r1' });
    prisma.availabilityResponse.update.mockResolvedValue({
      uniqueIndex: 123,
      status: AvailabilityStatus.PRESENT,
      source: ResponseSource.PLAYER,
      respondedAt: new Date('2026-07-23T12:00:00Z'),
    });
    roster.getClubMembers.mockResolvedValue([]);

    await expect(
      service.submitResponse(42, {
        uniqueIndex: 123,
        status: AvailabilityStatus.PRESENT,
        responseToken: 'signed',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        uniqueIndex: 123,
        status: AvailabilityStatus.PRESENT,
      }),
    );
    expect(prisma.availabilityResponse.update).toHaveBeenCalledTimes(1);
  });

  it('rejects poll creation for a fixture outside the captain club', async () => {
    roster.getMatch.mockResolvedValue({
      HomeClub: 'OTHER',
      AwayClub: 'AWAY',
    });

    await expect(
      service.createPoll(42, captain, {
        teamId: 'C1 A',
        clubIndex: 'C1',
        rosterUniqueIndexes: [123],
      }),
    ).rejects.toThrow('This match does not involve your club');
    expect(prisma.availabilityPoll.create).not.toHaveBeenCalled();
  });

  it('validates fixture, team and roster before creating and notifying a poll', async () => {
    roster.getMatch.mockResolvedValue({
      HomeClub: 'C1',
      AwayClub: 'C2',
      DivisionId: 10,
    });
    roster.getClubTeams.mockResolvedValue([{ TeamId: 'C1 A', DivisionId: 10 }]);
    roster.getClubMembers.mockResolvedValue([
      { UniqueIndex: 123 },
      { UniqueIndex: 456 },
    ]);
    prisma.availabilityPoll.findUnique.mockResolvedValue(null);
    prisma.availabilityPoll.create.mockResolvedValue({
      id: 'poll-1',
      matchUniqueId: 42,
      teamId: 'C1 A',
      clubIndex: 'C1',
      createdAt: new Date('2026-07-23T12:00:00Z'),
    });
    tokens.signResponseToken.mockResolvedValue('signed');
    notifier.sendMany.mockResolvedValue(2);

    await expect(
      service.createPoll(42, captain, {
        teamId: 'C1 A',
        clubIndex: 'C1',
        rosterUniqueIndexes: [123, 456],
      }),
    ).resolves.toEqual(expect.objectContaining({ id: 'poll-1' }));
    expect(tokens.signResponseToken).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: 'poll-1',
        matchUniqueId: 42,
        purpose: 'availability',
      }),
    );
    expect(notifier.sendMany).toHaveBeenCalledTimes(1);
  });
});
