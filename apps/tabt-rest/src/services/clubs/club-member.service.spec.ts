import { Test, TestingModule } from '@nestjs/testing';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';
import { ClubMemberService } from './club-member.service';
import { MemberEntry } from '../../entity/tabt-soap/TabTAPI_Port';

describe('ClubMemberService', () => {
  let service: ClubMemberService;
  let tabtService: TabtClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubMemberService,
        {
          provide: TabtClientService,
          useValue: {
            GetMembersAsync: jest.fn(),
          },
        },
      ],
    }).compile();
    tabtService = module.get<TabtClientService>(TabtClientService);

    service = module.get<ClubMemberService>(ClubMemberService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMembers', () => {
    it('should call the tabt service correctly and returns the match entries', async () => {
      const members = [
        {
          Position: 1,
          UniqueIndex: 142453,
          RankingIndex: 0,
          FirstName: 'FLORENT',
          LastName: 'CARDOEN',
          Ranking: 'D2',
          Status: 'A',
          Club: 'N051',
        },
      ] as MemberEntry[];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetMembersAsync')
        .mockResolvedValue({
          MemberCount: 1,
          MemberEntries: members,
        });
      const input = {
        Club: 'L360',
      };

      const result = await service.getClubsMembers(input);

      expect(result).toBeDefined();
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith(input);
    });
  });
});
