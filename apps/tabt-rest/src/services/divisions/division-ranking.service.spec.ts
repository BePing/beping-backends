import { Test, TestingModule } from '@nestjs/testing';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';
import { RankingEntry } from '../../entity/tabt-soap/TabTAPI_Port';
import { DivisionRankingService } from './division-ranking.service';

describe('DivisionRankingService', () => {
  let service: DivisionRankingService;
  let tabtService: TabtClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DivisionRankingService,
        {
          provide: TabtClientService,
          useValue: {
            GetDivisionRankingAsync: jest.fn(),
          },
        },
      ],
    }).compile();
    tabtService = module.get<TabtClientService>(TabtClientService);

    service = module.get<DivisionRankingService>(DivisionRankingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMembers', () => {
    it('should call the tabt service correctly and returns the match entries', async () => {
      const rankings = [
        {
          Position: 1,
          Team: 'Raquette Rouge Basecles C',
          GamesPlayed: 18,
          GamesWon: 16,
          GamesLost: 1,
          GamesDraw: 1,
          GamesWO: 0,
          IndividualMatchesWon: 143,
          IndividualMatchesLost: 37,
          IndividualSetsWon: 375,
          IndividualSetsLost: 174,
          Points: 51,
          TeamClub: 'H297',
        },
      ] as RankingEntry[];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetDivisionRankingAsync')
        .mockResolvedValue({
          DivisionName: 'r',
          RankingEntries: rankings,
        });
      const input = {
        DivisionId: 123,
        WeekName: '1',
      };

      const result = await service.getDivisionRanking(input);

      expect(result).toBe(rankings);
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith(input);
    });
  });
});
