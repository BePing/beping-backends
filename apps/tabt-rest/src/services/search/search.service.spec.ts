import { Test, TestingModule } from '@nestjs/testing';
import { MemberService } from '../members/member.service';
import { ClubService } from '../clubs/club.service';
import { TournamentService } from '../tournaments/tournament.service';
import { CacheService } from '@app/common';
import { MemberEntry } from '../../entity/tabt-soap/TabTAPI_Port';
import { SearchService, SearchType } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let memberService: { getMembersV1: jest.Mock };
  let clubService: { getClubs: jest.Mock };
  let tournamentService: { getTournaments: jest.Mock };
  let cacheService: { getFromCacheOrGetAndCacheResult: jest.Mock };

  beforeEach(async () => {
    memberService = { getMembersV1: jest.fn().mockResolvedValue([]) };
    clubService = { getClubs: jest.fn().mockResolvedValue([]) };
    tournamentService = { getTournaments: jest.fn().mockResolvedValue([]) };
    cacheService = {
      // Bypass the cache and always execute the getter so the real search
      // logic runs during the test.
      getFromCacheOrGetAndCacheResult: jest.fn((_key, getter) => getter()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: MemberService, useValue: memberService },
        { provide: ClubService, useValue: clubService },
        { provide: TournamentService, useValue: tournamentService },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should search across all types by default', async () => {
      await service.search('anything');

      expect(memberService.getMembersV1).toHaveBeenCalledWith({
        nameSearch: 'anything',
      });
      expect(clubService.getClubs).toHaveBeenCalledTimes(1);
      expect(tournamentService.getTournaments).toHaveBeenCalledWith({});
    });

    it('should only query the requested types', async () => {
      await service.search('anything', [SearchType.CLUB]);

      expect(clubService.getClubs).toHaveBeenCalledTimes(1);
      expect(memberService.getMembersV1).not.toHaveBeenCalled();
      expect(tournamentService.getTournaments).not.toHaveBeenCalled();
    });

    it('should return members matching the query and drop the ones below the threshold', async () => {
      const members = [
        {
          Position: 1,
          UniqueIndex: 123,
          FirstName: 'John',
          LastName: 'Smith',
          Ranking: 'B2',
          Club: 'L360',
        },
        {
          Position: 2,
          UniqueIndex: 456,
          FirstName: 'Zzzzzz',
          LastName: 'Qqqqqq',
          Ranking: 'C0',
          Club: 'L360',
        },
      ] as MemberEntry[];
      memberService.getMembersV1.mockResolvedValue(members);

      const result = await service.search('John', [SearchType.MEMBER]);

      expect(result.members).toHaveLength(1);
      expect(result.members[0].UniqueIndex).toBe(123);
      expect(result.members[0].FirstName).toBe('John');
    });

    it('should return clubs matching the query', async () => {
      clubService.getClubs.mockResolvedValue([
        {
          UniqueIndex: 'L360',
          Name: 'Pingouins',
          LongName: 'TT Pingouins',
          Category: 10,
          CategoryName: 'Liege',
          VenueCount: 0,
          VenueEntries: [],
        },
        {
          UniqueIndex: 'A999',
          Name: 'Wombats',
          LongName: 'TT Wombats',
          Category: 10,
          CategoryName: 'Antwerp',
          VenueCount: 0,
          VenueEntries: [],
        },
      ]);

      const result = await service.search('Pingouins', [SearchType.CLUB]);

      expect(result.clubs).toHaveLength(1);
      expect(result.clubs[0].uniqueIndex).toBe('L360');
      expect(result.clubs[0].name).toBe('Pingouins');
    });

    it('should return tournaments matching the query', async () => {
      tournamentService.getTournaments.mockResolvedValue([
        { UniqueIndex: 1, Name: 'Summer Open' },
        { UniqueIndex: 2, Name: 'Winter Classic' },
      ]);

      const result = await service.search('Summer Open', [
        SearchType.TOURNAMENT,
      ]);

      expect(result.tournaments).toHaveLength(1);
      expect(result.tournaments[0].uniqueIndex).toBe(1);
      expect(result.tournaments[0].name).toBe('Summer Open');
    });

    it('should propagate dependency failures instead of caching a false empty result', async () => {
      memberService.getMembersV1.mockRejectedValue(new Error('SOAP down'));

      await expect(service.search('John', [SearchType.MEMBER])).rejects.toThrow(
        'SOAP down',
      );
    });

    it('should normalize whitespace and casing before querying and caching', async () => {
      await service.search('  JoHn  ', [SearchType.MEMBER]);

      expect(memberService.getMembersV1).toHaveBeenCalledWith({
        nameSearch: 'john',
      });
    });

    it('should cap each result type to 25 entries', async () => {
      memberService.getMembersV1.mockResolvedValue(
        Array.from({ length: 30 }, (_, index) => ({
          Position: index + 1,
          UniqueIndex: index + 1,
          FirstName: 'John',
          LastName: `Smith${index}`,
          Ranking: 'B2',
          Club: 'L360',
        })),
      );

      const result = await service.search('John', [SearchType.MEMBER]);

      expect(result.members).toHaveLength(25);
    });

    it('should build a stable cache key regardless of the type order', async () => {
      await service.search('foo', [SearchType.CLUB, SearchType.MEMBER]);
      await service.search('foo', [SearchType.MEMBER, SearchType.CLUB]);

      const [firstKey] =
        cacheService.getFromCacheOrGetAndCacheResult.mock.calls[0];
      const [secondKey] =
        cacheService.getFromCacheOrGetAndCacheResult.mock.calls[1];
      expect(firstKey).toEqual(secondKey);
    });
  });
});
