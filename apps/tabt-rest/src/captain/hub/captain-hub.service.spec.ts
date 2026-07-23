import { AvailabilityStatus, LineupStatus } from '@app/common';
import { CaptainHubService } from './captain-hub.service';

describe('CaptainHubService', () => {
  const prisma = {
    availabilityPoll: { findMany: jest.fn() },
    lineup: { findMany: jest.fn() },
    convocation: { findMany: jest.fn() },
  };
  const roster = {
    getClubTeams: jest.fn(),
    getClubMatches: jest.fn(),
  };
  let service: CaptainHubService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CaptainHubService(prisma as any, roster as any);
  });

  it('selects the next fixture per division and summarizes its preparation', async () => {
    roster.getClubTeams.mockResolvedValue([
      {
        TeamId: 'C1 A',
        Team: 'C1 A',
        DivisionId: 10,
        DivisionName: 'Division 1',
      },
      {
        TeamId: 'C1 B',
        Team: 'C1 B',
        DivisionId: 20,
        DivisionName: undefined,
      },
      {
        TeamId: 'C1 C',
        Team: 'C1 C',
        DivisionId: 30,
        DivisionName: 'Division 3',
      },
    ]);
    roster.getClubMatches.mockResolvedValue([
      { DivisionId: 10, Date: undefined },
      { DivisionId: 10, Date: '2020-01-01', Time: '20:00' },
      {
        DivisionId: 10,
        MatchUniqueId: 102,
        Date: '2099-02-01',
        Time: '20:00',
      },
      {
        DivisionId: 10,
        MatchUniqueId: 101,
        Date: '2099-01-01',
        Time: '20:00',
        HomeClub: 'C1',
        HomeTeam: 'C1 A',
        AwayTeam: 'Visitors A',
        VenueEntry: { Name: 'Home hall' },
        WeekName: 'Week 1',
      },
      { DivisionId: 20, Date: 'not-a-date', Time: 'later' },
      {
        DivisionId: 20,
        MatchUniqueId: 202,
        Date: '2099-01-02',
        Time: '',
        HomeClub: 'C2',
        HomeTeam: 'Hosts B',
        AwayTeam: 'C1 B',
      },
    ]);
    prisma.availabilityPoll.findMany.mockResolvedValue([
      {
        matchUniqueId: 101,
        responses: [
          { status: AvailabilityStatus.PRESENT },
          { status: AvailabilityStatus.ABSENT },
          { status: AvailabilityStatus.PENDING },
        ],
      },
    ]);
    prisma.lineup.findMany.mockResolvedValue([
      { matchUniqueId: 101, status: LineupStatus.VALIDEE },
    ]);
    prisma.convocation.findMany.mockResolvedValue([{ matchUniqueId: 101 }]);

    const result = await service.getHub({
      uniqueIndex: 1,
      clubIndex: 'C1',
    });

    expect(result.teams).toHaveLength(3);
    expect(result.teams[0]).toEqual(
      expect.objectContaining({
        divisionName: 'Division 1',
        nextMatch: expect.objectContaining({
          matchUniqueId: 101,
          opponent: 'Visitors A',
          home: true,
          venue: 'Home hall',
        }),
        prep: {
          availability: { present: 1, absent: 1, pending: 1, total: 3 },
          lineupStatus: LineupStatus.VALIDEE,
          convocationSent: true,
        },
      }),
    );
    expect(result.teams[1]).toEqual(
      expect.objectContaining({
        divisionName: '',
        nextMatch: expect.objectContaining({
          matchUniqueId: 202,
          opponent: 'Hosts B',
          home: false,
        }),
        prep: {
          availability: undefined,
          lineupStatus: LineupStatus.A_FAIRE,
          convocationSent: false,
        },
      }),
    );
    expect(result.teams[2].nextMatch).toBeUndefined();
    expect(prisma.availabilityPoll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          matchUniqueId: { in: [101, 202] },
          clubIndex: 'C1',
        },
      }),
    );
  });
});
