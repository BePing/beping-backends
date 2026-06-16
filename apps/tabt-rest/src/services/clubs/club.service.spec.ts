import { Test, TestingModule } from '@nestjs/testing';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';
import { ClubEntry } from '../../entity/tabt-soap/TabTAPI_Port';
import { ClubService } from './club.service';

describe('ClubService', () => {
  let service: ClubService;
  let tabtService: TabtClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubService,
        {
          provide: TabtClientService,
          useValue: {
            GetClubsAsync: jest.fn(),
          },
        },
      ],
    }).compile();
    tabtService = module.get<TabtClientService>(TabtClientService);
    service = module.get<ClubService>(ClubService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getClubs', () => {
    it('should call the tabt service correctly and returns the club entries', async () => {
      const clubs = [
        {
          UniqueIndex: 'L360',
          Name: 'Sfx',
          LongName: 'TT Sfx',
          Category: 10,
          CategoryName: 'Li&egrave;ge',
          VenueCount: 1,
          VenueEntries: [],
        },
        {
          UniqueIndex: 'abc',
          Name: 'dqsfqsdf',
          LongName: 'TT qdsfqsdf',
          Category: 10,
          CategoryName: 'Antwerp',
          VenueCount: 1,
          VenueEntries: [],
        },
      ] as ClubEntry[];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetClubsAsync')
        .mockResolvedValue({
          ClubCount: 2,
          ClubEntries: clubs,
        });
      const input = {};

      const result = await service.getClubs(input);

      expect(result).toEqual(clubs);
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith(input);
    });
  });
  describe('getClubById', () => {
    it('should call the tabt service correctly and returns the exact club', async () => {
      const clubs = [
        {
          UniqueIndex: 'L360',
          Name: 'Sfx',
          LongName: 'TT Sfx',
          Category: 10,
          CategoryName: 'Li&egrave;ge',
          VenueCount: 1,
          VenueEntries: [],
        },
        {
          UniqueIndex: 'abc',
          Name: 'dqsfqsdf',
          LongName: 'TT qdsfqsdf',
          Category: 10,
          CategoryName: 'Antwerp',
          VenueCount: 1,
          VenueEntries: [],
        },
      ] as ClubEntry[];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetClubsAsync')
        .mockResolvedValue({
          ClubCount: 2,
          ClubEntries: clubs,
        });
      const input = {};

      const result = await service.getClubById('L360');

      expect(result).toEqual(clubs[0]);
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith(input);
    });

    it('should call the tabt service correctly and returns null if not found', async () => {
      const clubs = [] as ClubEntry[];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetClubsAsync')
        .mockResolvedValue({
          ClubCount: 0,
          ClubEntries: clubs,
        });
      const input = {};

      const result = await service.getClubById('L360');

      expect(result).toBeUndefined();
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith(input);
    });
  });
});
