import { Test, TestingModule } from '@nestjs/testing';
import { DivisionsController } from './divisions.controller';
import { DivisionService } from '../../../services/divisions/division.service';
import { DivisionRankingService } from '../../../services/divisions/division-ranking.service';
import { MatchService } from '../../../services/matches/match.service';
import {
  GetDivisionMatchesV1,
  GetDivisionRankingV1,
  GetDivisionsV1,
} from '../dto/divisions.dto';
import { NotFoundException } from '@nestjs/common';
import { MatchesMembersRankerService } from '../../../services/matches/matches-members-ranker.service';
import { DivisionCategoryDTO } from '../../../common/dto/division-category.dto';

jest.mock('../../../services/matches/match.service');
jest.mock('../../../services/divisions/division.service');
jest.mock('../../../services/divisions/division-ranking.service');
jest.mock('../../../services/matches/matches-members-ranker.service');

describe('DivisionsController', () => {
  let controller: DivisionsController;
  let divisionService: DivisionService;
  let divisionRankingService: DivisionRankingService;
  let matchService: MatchService;
  let matchesMembersRankerService: MatchesMembersRankerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DivisionsController],
      providers: [
        {
          provide: DivisionService,
          useValue: {
            getDivisionsV1: jest.fn(),
            getDivisionByIdV1: jest.fn(),
          },
        },
        DivisionRankingService,
        MatchService,
        MatchesMembersRankerService,
      ],
    }).compile();

    controller = module.get<DivisionsController>(DivisionsController);
    divisionService = module.get<DivisionService>(DivisionService);
    matchService = module.get<MatchService>(MatchService);
    divisionRankingService = module.get<DivisionRankingService>(
      DivisionRankingService,
    );
    matchesMembersRankerService = module.get<MatchesMembersRankerService>(
      MatchesMembersRankerService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Division ranking', () => {
    it('should call division ranking service with correct params', async () => {
      const input: GetDivisionRankingV1 = {
        weekName: '1',
        rankingSystem: 1,
      };

      const spy = jest.spyOn(divisionRankingService, 'getDivisionRanking');

      const result = await controller.findRankingDivisionV1(4755, input);

      expect(result).toBeDefined();
      expect(result[0]).toBeDefined();
      expect(spy).toHaveBeenCalledWith({
        DivisionId: 4755,
        RankingSystem: 1,
        WeekName: '1',
      });
    });
  });
  describe('Division matches', () => {
    it('should call match service with correct params', async () => {
      const input: GetDivisionMatchesV1 = {
        weekName: '1',
        yearDateFrom: '1995-12-13',
        yearDateTo: '1995-12-14',
        withDetails: true,
      };

      const spy = jest.spyOn(matchService, 'getMatches');

      const result = await controller.findMatchesDivisionV1(4755, input);

      expect(result).toBeDefined();
      expect(result[0]).toBeDefined();
      expect(spy).toHaveBeenCalledWith({
        DivisionId: 4755,
      });
    });
  });

  describe('getDivisionsV1', () => {
    it('should call division service with correct params', async () => {
      const input: GetDivisionsV1 = {
        showDivisionName: 'yes',
        level: 'NATIONAL',
        divisionCategory: DivisionCategoryDTO.SENIOR_MEN,
      };

      const spy = jest.spyOn(divisionService, 'getDivisionsV1');
      spy.mockResolvedValue([]);

      const result = await controller.getDivisionsV1(input);

      expect(result).toBeDefined();
      expect(spy).toHaveBeenCalledWith(input);
    });
  });

  describe('findOneV1', () => {
    it('should return division when found', async () => {
      const divisionId = 4755;
      const spy = jest.spyOn(divisionService, 'getDivisionByIdV1');
      spy.mockResolvedValue({ DivisionId: divisionId } as any);

      const result = await controller.findOneV1(divisionId);

      expect(result).toBeDefined();
      expect(spy).toHaveBeenCalledWith(divisionId);
    });

    it('should throw NotFoundException when division not found', async () => {
      const divisionId = 4755;
      const spy = jest.spyOn(divisionService, 'getDivisionByIdV1');
      spy.mockResolvedValue(null);

      await expect(controller.findOneV1(divisionId)).rejects.toThrow(
        NotFoundException,
      );
      expect(spy).toHaveBeenCalledWith(divisionId);
    });
  });

  describe('findMembersInDivisionV1', () => {
    it('should call matchesMembersRankerService with correct params', async () => {
      const divisionId = 4755;
      const spy = jest.spyOn(
        matchesMembersRankerService,
        'getMembersRankingFromDivision',
      );
      spy.mockResolvedValue([]);

      const result = await controller.findMembersInDivisionV1(divisionId);

      expect(result).toBeDefined();
      expect(spy).toHaveBeenCalledWith(divisionId);
    });
  });
});
