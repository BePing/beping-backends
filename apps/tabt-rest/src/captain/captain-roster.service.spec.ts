import { LineupCategory } from './lineup/rules/rule.types';
import { CaptainRosterService } from './captain-roster.service';

describe('CaptainRosterService', () => {
  const members = {
    getClubsMembers: jest.fn(),
  };
  const teams = {
    getClubsTeams: jest.fn(),
  };
  const matches = {
    getMatches: jest.fn(),
  };
  let service: CaptainRosterService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CaptainRosterService(
      members as any,
      teams as any,
      matches as any,
    );
  });

  it('builds category-specific rosters and filters requested players', async () => {
    members.getClubsMembers.mockResolvedValue([
      {
        UniqueIndex: 1,
        FirstName: 'Ada',
        LastName: 'A',
        Gender: 'F',
        Ranking: 'B2',
        RankingIndex: 2,
        Position: 1,
      },
      {
        UniqueIndex: 2,
        FirstName: 'Bob',
        LastName: 'B',
        Gender: 'M',
        Ranking: 'C2',
        RankingIndex: 3,
        Position: 2,
      },
    ]);

    await expect(
      service.buildRoster('C1', LineupCategory.WOMEN),
    ).resolves.toEqual(
      new Map([[1, expect.objectContaining({ firstName: 'Ada' })]]),
    );
    await expect(
      service.buildRoster('C1', LineupCategory.MEN),
    ).resolves.toEqual(
      new Map([[2, expect.objectContaining({ firstName: 'Bob' })]]),
    );
    await expect(service.rosterForUniqueIndexes('C1', [2])).resolves.toEqual(
      new Map([[2, expect.objectContaining({ lastName: 'B' })]]),
    );
  });

  it('derives team metadata for women, veterans and default men teams', async () => {
    const clubTeams = [
      {
        TeamId: 'women',
        Team: 'Club B',
        DivisionCategory: 38,
        DivisionName: 'Division',
        DivisionId: 1,
      },
      {
        TeamId: 'veterans',
        Team: 'Club C',
        DivisionName: 'Vétérans',
        DivisionId: 2,
      },
      {
        TeamId: 'men',
        Team: undefined,
        DivisionName: 'Messieurs',
        DivisionId: 3,
      },
    ];
    teams.getClubsTeams.mockResolvedValue(clubTeams);

    await expect(service.teamMeta('C1')).resolves.toEqual(
      new Map([
        ['women', { teamRankInClub: 2, category: LineupCategory.WOMEN }],
        ['veterans', { teamRankInClub: 3, category: LineupCategory.VETERANS }],
        ['men', { teamRankInClub: 1, category: LineupCategory.MEN }],
      ]),
    );
    await expect(service.resolveTeamContext('C1', 'women')).resolves.toEqual({
      teamId: 'women',
      teamLetter: 'B',
      teamRankInClub: 2,
      teamSize: 3,
      category: LineupCategory.WOMEN,
      divisionId: 1,
    });
    await expect(
      service.resolveTeamContext('C1', 'missing'),
    ).resolves.toBeNull();

    expect(
      CaptainRosterService.categoryOf({
        DivisionName: 'Women league',
      } as any),
    ).toBe(LineupCategory.WOMEN);
    expect(
      CaptainRosterService.categoryOf({
        DivisionName: 'Veteran league',
      } as any),
    ).toBe(LineupCategory.VETERANS);
    expect(CaptainRosterService.teamSizeOf(LineupCategory.MEN)).toBe(4);
  });

  it('maps club fixtures and tolerates matches without identifiers', async () => {
    matches.getMatches
      .mockResolvedValueOnce([{ MatchUniqueId: 42 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { MatchUniqueId: 42, WeekName: 'W1' },
        { MatchUniqueId: undefined, WeekName: 'W2' },
      ])
      .mockResolvedValueOnce([{ MatchUniqueId: 43 }]);

    await expect(service.getMatch(42)).resolves.toEqual({ MatchUniqueId: 42 });
    await expect(service.getMatch(404)).resolves.toBeNull();
    await expect(service.clubMatchWeeks('C1')).resolves.toEqual(
      new Map([[42, 'W1']]),
    );
    await expect(service.getClubMatches('C1')).resolves.toEqual([
      { MatchUniqueId: 43 },
    ]);
  });
});
