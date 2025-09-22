import { Test, TestingModule } from '@nestjs/testing';
import { MemberController } from './member.controller';
import { MemberService } from '../../../services/members/member.service';
import {
  GetMemberV1,
  WeeklyNumericPointsInputV1,
  WeeklyNumericPointsV1,
} from '../dto/member.dto';
import { NotFoundException } from '@nestjs/common';
import { SeasonService } from '../../../services/seasons/season.service';
import { PlayerCategoryDTO } from '../../../common/dto/player-category.dto';
import { NumericRankingService } from '../../../services/members/numeric-ranking.service';
import { MemberCategoryService } from '../../../services/members/member-category.service';

jest.mock('../../../services/members/member.service');
jest.mock('../../../services/seasons/season.service');
jest.mock('../../../services/members/member-category.service');
jest.mock('../../../services/members/numeric-ranking.service');

describe('MemberController', () => {
  let controller: MemberController;
  let service: MemberService;
  let seasonService: SeasonService;
  let memberCategoryService: MemberCategoryService;
  let numericRankingService: NumericRankingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemberController],
      providers: [
        MemberService,
        MemberCategoryService,
        SeasonService,
        NumericRankingService,
      ],
    }).compile();

    controller = module.get<MemberController>(MemberController);
    service = module.get<MemberService>(MemberService);
    seasonService = module.get<SeasonService>(SeasonService);
    memberCategoryService = module.get<MemberCategoryService>(
      MemberCategoryService,
    );
    numericRankingService = module.get<NumericRankingService>(
      NumericRankingService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call members service with correct param', async () => {
    const input = {
      club: 'L360',
      uniqueIndex: 142453,
      extendedInformation: 'true',
      nameSearch: 'florent',
      playerCategory: 'MEN',
      rankingPointsInformation: 'true',
      withOpponentRankingEvaluation: 'true',
      withResults: 'true',
    };
    const spy = jest.spyOn(service, 'getMembersV1').mockResolvedValue([]);

    try {
      const result = await controller.findAll(input as unknown as GetMemberV1);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(NotFoundException);
      expect(spy).toHaveBeenCalledWith(input);
    }
  });

  it('should call members service with correct param - 1 player', async () => {
    const input = {
      club: 'L360',
      extendedInformation: 'true',
      nameSearch: 'florent',
      playerCategory: 'MEN',
      rankingPointsInformation: 'true',
      withOpponentRankingEvaluation: 'true',
      withResults: 'true',
    };
    const spy = jest.spyOn(service, 'getMembersV1').mockResolvedValue([
      {
        UniqueIndex: 142453,
        FirstName: 'florent',
        LastName: 'florent',
        Position: 1,
        RankingIndex: 1,
        Ranking: '1',
        Status: '1',
        Club: 'L360',
      },
    ]);

    const result = await controller.findById(
      input as unknown as GetMemberV1,
      142453,
    );

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(spy).toHaveBeenCalledWith({ ...input, uniqueIndex: 142453 });
  });

  it('should throw 404 exeption if not found', async () => {
    const input: GetMemberV1 = {};
    jest.spyOn(service, 'getMembersV1').mockResolvedValue([]);

    await expect(controller.findById(input, 142453)).rejects.toEqual(
      new NotFoundException(),
    );
  });
});
