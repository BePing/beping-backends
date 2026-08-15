import { Test, TestingModule } from '@nestjs/testing';
import { MemberController } from './member.controller';
import { MemberService } from '../../../services/members/member.service';
import { GetMemberV1 } from '../dto/member.dto';
import { NotFoundException } from '@nestjs/common';
import { SeasonService } from '../../../services/seasons/season.service';
import { NumericRankingService } from '../../../services/members/numeric-ranking.service';
import { MemberCategoryService } from '../../../services/members/member-category.service';
import { MemberLookupService } from '../../../services/members/member-lookup.service';

jest.mock('../../../services/members/member.service');
jest.mock('../../../services/seasons/season.service');
jest.mock('../../../services/members/member-category.service');
jest.mock('../../../services/members/numeric-ranking.service');
jest.mock('../../../services/members/member-lookup.service');

describe('MemberController', () => {
  let controller: MemberController;
  let service: MemberService;
  let lookupService: MemberLookupService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemberController],
      providers: [
        MemberService,
        MemberLookupService,
        MemberCategoryService,
        SeasonService,
        NumericRankingService,
      ],
    }).compile();

    controller = module.get<MemberController>(MemberController);
    service = module.get<MemberService>(MemberService);
    lookupService = module.get<MemberLookupService>(MemberLookupService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should use the resilient member lookup endpoint', async () => {
    const members = [
      {
        Position: 87,
        UniqueIndex: 142453,
        RankingIndex: 87,
        FirstName: 'Florent',
        LastName: 'Cardoen',
        Ranking: 'B4',
        Status: '',
        Club: 'L360',
      },
    ];
    const spy = jest
      .spyOn(lookupService, 'lookupByName')
      .mockResolvedValue(members);

    await expect(
      controller.lookup({ nameSearch: 'Florent Cardoen' }),
    ).resolves.toEqual(members);
    expect(spy).toHaveBeenCalledWith('Florent Cardoen');
  });

  it('should return an empty list when the member search has no result', async () => {
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

    await expect(
      controller.findAll(input as unknown as GetMemberV1),
    ).resolves.toEqual([]);
    expect(spy).toHaveBeenCalledWith(input);
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
