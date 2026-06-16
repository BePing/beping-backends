import { Test, TestingModule } from '@nestjs/testing';
import { SeasonService } from './season.service';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';
import { ContextService } from '../../common/context/context.service';
import { HeaderKeys } from '../../common/context/context.constants';
import { ConfigService } from '@nestjs/config';

jest.mock('../../common/context/context.service');
describe('SeasonService', () => {
  let provider: SeasonService;
  let tabtService: TabtClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeasonService,
        {
          provide: ContextService,
          useValue: {
            context: {
              runner: {
                name: 'test',
                version: '1,0,0',
                pid: 1234,
                season: 18,
              },
              caller: {
                correlationId: '123',
                remoteAddress: '12.12.12.12',
                [HeaderKeys.X_FORWARDED_FOR]: '11.11.11.11',
              },
            },
          },
        },
        {
          provide: TabtClientService,
          useValue: {
            GetSeasonsAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(18),
          },
        },
      ],
    }).compile();

    provider = module.get<SeasonService>(SeasonService);
    tabtService = module.get<TabtClientService>(TabtClientService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getSeasons', () => {
    it('should call the tabt service correctly and returns the seasons entries', async () => {
      const seasons = [{ Name: '1', IsCurrent: false, Season: 18 }];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetSeasonsAsync')
        .mockResolvedValue({
          CurrentSeason: 18,
          CurrentSeasonName: '1',
          SeasonEntries: seasons,
        });

      const result = await provider.getSeasons();

      expect(result).toBe(seasons);
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith({});
    });
  });

  describe('getCurrentSeason', () => {
    it('should call the tabt service correctly and returns the current seasons entries', async () => {
      const currentSeason = { Name: '2', IsCurrent: true, Season: 19 };
      const seasons = [
        { Name: '1', IsCurrent: false, Season: 18 },
        currentSeason,
      ];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetSeasonsAsync')
        .mockResolvedValue({
          CurrentSeason: 18,
          CurrentSeasonName: '1',
          SeasonEntries: seasons,
        });

      const result = await provider.getCurrentSeason();

      expect(result).toBe(seasons[0]);
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith({});
    });
  });
});
