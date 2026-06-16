import { Test, TestingModule } from '@nestjs/testing';
import { ClubTeamService } from './club-team.service';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';
import { TeamEntry } from '../../entity/tabt-soap/TabTAPI_Port';

describe('ClubTeamService', () => {
  let service: ClubTeamService;
  let tabtService: TabtClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubTeamService,
        {
          provide: TabtClientService,
          useValue: {
            GetClubTeamsAsync: jest.fn(),
          },
        },
      ],
    }).compile();
    tabtService = module.get<TabtClientService>(TabtClientService);
    service = module.get<ClubTeamService>(ClubTeamService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getClubsTeams', () => {
    it('should call the tabt service correctly and returns the team entries', async () => {
      const teams = [
        {
          TeamId: 'a',
          Team: 'a',
          DivisionId: 123,
          DivisionName: 'a',
          DivisionCategory: 1,
          MatchType: 5,
        },
      ] as TeamEntry[];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetClubTeamsAsync')
        .mockResolvedValue({
          ClubName: 'a',
          TeamCount: 1,
          TeamEntries: teams,
        });
      const input = {
        Club: 'L360',
      };

      const result = await service.getClubsTeams(input);

      expect(result).toBeDefined();
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith(input);
    });
  });
});
