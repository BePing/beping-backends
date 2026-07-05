import { Test, TestingModule } from '@nestjs/testing';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';
import { ContextService } from '../../common/context/context.service';
import { MemberEntry } from '../../entity/tabt-soap/TabTAPI_Port';
import { GetMembersV1 } from '../../api/member/dto/member.dto';
import { PlayerCategoryDTO } from '../../common/dto/player-category.dto';
import { PlayerCategory } from '../../entity/tabt-input.interface';
import { MemberService } from './member.service';

describe('MemberService', () => {
  let service: MemberService;
  let tabtService: TabtClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberService,
        {
          provide: TabtClientService,
          useValue: {
            GetMembersAsync: jest.fn(),
          },
        },
        {
          provide: ContextService,
          useValue: {},
        },
      ],
    }).compile();
    tabtService = module.get<TabtClientService>(TabtClientService);
    service = module.get<MemberService>(MemberService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMembersV1', () => {
    it('should map the query to the SOAP input and return the member entries', async () => {
      const members = [
        {
          Position: 1,
          UniqueIndex: 123,
          FirstName: 'John',
          LastName: 'Doe',
          Ranking: 'B2',
          Club: 'L360',
        },
        {
          Position: 2,
          UniqueIndex: 456,
          FirstName: 'Jane',
          LastName: 'Doe',
          Ranking: 'C0',
          Club: 'L360',
        },
      ] as MemberEntry[];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetMembersAsync')
        .mockResolvedValue({
          MemberCount: 2,
          MemberEntries: members,
        });

      const query: GetMembersV1 = {
        club: 'L360',
        playerCategory: PlayerCategoryDTO.SENIOR_MEN,
        uniqueIndex: 123,
        nameSearch: 'Doe',
        extendedInformation: true,
        rankingPointsInformation: true,
        withResults: false,
        withOpponentRankingEvaluation: false,
      };

      const result = await service.getMembersV1(query);

      expect(result).toEqual(members);
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith({
        Club: 'L360',
        PlayerCategory: PlayerCategory.SENIOR_MEN,
        UniqueIndex: 123,
        NameSearch: 'Doe',
        ExtendedInformation: true,
        RankingPointsInformation: true,
        WithResults: false,
        WithOpponentRankingEvaluation: false,
      });
    });

    it('should return an empty array when the SOAP response has no member entries', async () => {
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetMembersAsync')
        .mockResolvedValue({
          MemberCount: 0,
          MemberEntries: undefined,
        });

      const result = await service.getMembersV1({});

      expect(result).toEqual([]);
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
    });

    it('should leave the player category undefined when none is provided', async () => {
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetMembersAsync')
        .mockResolvedValue({
          MemberCount: 0,
          MemberEntries: [],
        });

      await service.getMembersV1({ nameSearch: 'foo' });

      expect(spyOnTabt).toHaveBeenCalledWith(
        expect.objectContaining({
          NameSearch: 'foo',
          PlayerCategory: undefined,
        }),
      );
    });
  });
});
