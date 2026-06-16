import { Test, TestingModule } from '@nestjs/testing';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';
import { DivisionEntry } from '../../entity/tabt-soap/TabTAPI_Port';
import { DivisionService } from './division.service';

describe('DivisionService', () => {
  let service: DivisionService;
  let tabtService: TabtClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DivisionService,
        {
          provide: TabtClientService,
          useValue: {
            GetDivisionsAsync: jest.fn(),
          },
        },
      ],
    }).compile();
    tabtService = module.get<TabtClientService>(TabtClientService);
    service = module.get<DivisionService>(DivisionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDivisions', () => {
    it('should call the tabt service correctly and returns the division entries', async () => {
      const divisions = [
        {
          DivisionId: 4755,
          DivisionName: 'Super Heren - Super Division - Hommes',
          DivisionCategory: 1,
          Level: 1,
          MatchType: 8,
        },
        {
          DivisionId: 123,
          DivisionName: 'test',
          DivisionCategory: 1,
          Level: 1,
          MatchType: 8,
        },
      ] as DivisionEntry[];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetDivisionsAsync')
        .mockResolvedValue({
          DivisionCount: 2,
          DivisionEntries: divisions,
        });
      const input = {};

      const result = await service.getDivisionsV1(input);

      expect(result).toBeDefined();
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith(input);
    });
    it('should call the tabt service correctly and returns the exact division entries', async () => {
      const divisions = [
        {
          DivisionId: 4755,
          DivisionName: 'Super Heren - Super Division - Hommes',
          DivisionCategory: 1,
          Level: 1,
          MatchType: 8,
        },
        {
          DivisionId: 123,
          DivisionName: 'test',
          DivisionCategory: 1,
          Level: 1,
          MatchType: 8,
        },
      ] as DivisionEntry[];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetDivisionsAsync')
        .mockResolvedValue({
          DivisionCount: 2,
          DivisionEntries: divisions,
        });
      const input = {
        ShowDivisionName: 'yes',
      };

      const result = await service.getDivisionByIdV1(4755);

      expect(result).toBeDefined();
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith(input);
    });

    it('should call the tabt service correctly and returns 404 if not found', async () => {
      const divisions = [] as DivisionEntry[];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetDivisionsAsync')
        .mockResolvedValue({
          DivisionCount: 0,
          DivisionEntries: divisions,
        });
      const input = {
        ShowDivisionName: 'yes',
      };

      const result = await service.getDivisionByIdV1(123);

      expect(result).toBeNull();
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith(input);
    });
  });
});
