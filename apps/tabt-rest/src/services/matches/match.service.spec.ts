import { Test, TestingModule } from '@nestjs/testing';
import { MatchService } from './match.service';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';
import { TeamMatchesEntry } from '../../entity/tabt-soap/TabTAPI_Port';

describe('MatchService', () => {
  let service: MatchService;
  let tabtService: TabtClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchService,
        {
          provide: TabtClientService,
          useValue: {
            GetMatchesAsync: jest.fn(),
          },
        },
      ],
    }).compile();
    tabtService = module.get<TabtClientService>(TabtClientService);

    service = module.get<MatchService>(MatchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMatches', () => {
    it('should call the tabt service correctly and returns the match entries', async () => {
      const matches = [
        {
          MatchId: 'LgH01/481',
        },
      ] as TeamMatchesEntry[];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetMatchesAsync')
        .mockResolvedValue({
          MatchCount: 1,
          TeamMatchesEntries: matches,
        });
      const input = {
        Club: 'L360',
      };

      const result = await service.getMatches(input);

      expect(result).toBeDefined();
      expect(result[0]).toBeInstanceOf(TeamMatchesEntry);
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith(input);
    });
    it('should return an empty array if no matches are returned', async () => {
      const matches = [] as TeamMatchesEntry[];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetMatchesAsync')
        .mockResolvedValue({
          MatchCount: 0,
          TeamMatchesEntries: matches,
        });
      const input = {
        Club: 'L360',
      };

      const result = await service.getMatches(input);
      expect(result).toBeInstanceOf(Array);
      expect(result).toBeDefined();
      expect(result.length).toBe(0);
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith(input);
    });
  });
});
