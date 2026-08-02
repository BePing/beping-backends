import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  computeMyTeamSummary,
  MemberDashboardService,
} from './member-dashboard.service';
import { TeamMatchesEntry } from '../../../entity/tabt-soap/TabTAPI_Port';

describe('MemberDashboardService', () => {
  const cacheService = {
    getFromCacheOrGetAndCacheResult: jest.fn(
      (_key: string, getter: () => Promise<unknown>) => getter(),
    ),
  };
  const memberService = { getMembersV1: jest.fn() };
  const service = new MemberDashboardService(
    {} as never,
    cacheService as never,
    memberService as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('uses a typed 404 when the member does not exist', async () => {
    memberService.getMembersV1.mockResolvedValue([]);

    await expect(service.getDashboard(123)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('uses a typed 503 when a required dependency fails', async () => {
    memberService.getMembersV1.mockRejectedValue(new Error('SOAP down'));

    await expect(service.getDashboard(123)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('converts a single-dashboard cache failure to a typed 503', async () => {
    cacheService.getFromCacheOrGetAndCacheResult.mockRejectedValueOnce(
      new Error('Redis down'),
    );

    await expect(service.getDashboard(123)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('converts a multi-category cache failure to a typed 503', async () => {
    cacheService.getFromCacheOrGetAndCacheResult.mockRejectedValueOnce(
      new Error('Redis down'),
    );

    await expect(service.getMultiCategoryDashboard(123)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('preserves a not-found error returned through the cache layer', async () => {
    cacheService.getFromCacheOrGetAndCacheResult.mockRejectedValueOnce(
      new NotFoundException('missing'),
    );

    await expect(service.getDashboard(123)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('computeMyTeamSummary', () => {
  const match = (partial: Partial<TeamMatchesEntry>): TeamMatchesEntry =>
    ({
      MatchId: 'M',
      HomeClub: 'H001',
      HomeTeam: 'HOME A',
      AwayClub: 'A001',
      AwayTeam: 'AWAY A',
      DivisionId: 1,
      DivisionName: 'Division 1',
      Date: '2025-09-13',
      ...partial,
    }) as TeamMatchesEntry;

  it('prefers the most played team over the most recent one', () => {
    const summary = computeMyTeamSummary(
      [
        match({
          MatchId: '1',
          HomeTeam: 'PATAPONGISTES A',
          Date: '2025-09-13',
          DivisionId: 10,
          DivisionName: 'Nationale 1',
        }),
        match({
          MatchId: '2',
          HomeTeam: 'PATAPONGISTES A',
          Date: '2025-09-20',
          DivisionId: 10,
          DivisionName: 'Nationale 1',
        }),
        match({
          MatchId: '3',
          HomeTeam: 'PATAPONGISTES B',
          Date: '2025-10-04',
          DivisionId: 20,
          DivisionName: 'Provinciale 3',
        }),
      ],
      'H001',
    );

    expect(summary).toEqual({
      team: 'PATAPONGISTES A',
      divisionId: 10,
      divisionName: 'Nationale 1',
      matchCount: 2,
    });
  });

  it('breaks a tie with the most recently dated match', () => {
    const summary = computeMyTeamSummary(
      [
        match({ MatchId: '1', HomeTeam: 'TEAM A', Date: '2025-09-13' }),
        match({
          MatchId: '2',
          HomeTeam: 'TEAM B',
          Date: '2025-11-15',
          DivisionId: 42,
          DivisionName: 'Provinciale 2',
        }),
      ],
      'H001',
    );

    expect(summary).toEqual({
      team: 'TEAM B',
      divisionId: 42,
      divisionName: 'Provinciale 2',
      matchCount: 1,
    });
  });

  it('loses a tie when the dates cannot be parsed', () => {
    const summary = computeMyTeamSummary(
      [
        match({ MatchId: '1', HomeTeam: 'TEAM A', Date: '2025-09-13' }),
        match({ MatchId: '2', HomeTeam: 'TEAM B', Date: 'not-a-date' }),
      ],
      'H001',
    );

    expect(summary?.team).toBe('TEAM A');
  });

  it('resolves the team when the member club plays away', () => {
    const summary = computeMyTeamSummary(
      [
        match({
          MatchId: '1',
          HomeClub: 'OTHER',
          AwayClub: 'h001 ',
          AwayTeam: 'PATAPONGISTES C',
          DivisionId: 7,
          DivisionName: 'Provinciale 4',
        }),
      ],
      'H001',
    );

    expect(summary).toEqual({
      team: 'PATAPONGISTES C',
      divisionId: 7,
      divisionName: 'Provinciale 4',
      matchCount: 1,
    });
  });

  it('returns undefined when there is no match', () => {
    expect(computeMyTeamSummary([], 'H001')).toBeUndefined();
    expect(computeMyTeamSummary(undefined, 'H001')).toBeUndefined();
  });

  it('returns undefined when no match involves the member club', () => {
    expect(
      computeMyTeamSummary([match({ HomeClub: 'X', AwayClub: 'Y' })], 'H001'),
    ).toBeUndefined();
  });

  it('returns undefined when the member club is unknown', () => {
    expect(computeMyTeamSummary([match({})], undefined)).toBeUndefined();
  });
});
