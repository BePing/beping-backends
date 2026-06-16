import { Test, TestingModule } from '@nestjs/testing';
import { TournamentService } from './tournament.service';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';
import {
  IGetTournamentsOutput,
  TournamentEntry,
} from '../../entity/tabt-soap/TabTAPI_Port';

describe('TournamentService', () => {
  let provider: TournamentService;
  let tabtService: TabtClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentService,
        {
          provide: TabtClientService,
          useValue: {
            GetTournamentsAsync: jest.fn(),
            TournamentRegisterAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<TournamentService>(TournamentService);
    tabtService = module.get<TabtClientService>(TabtClientService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getTournaments', () => {
    it('should call the tabt service correctly and returns the tournament entries', async () => {
      const tournaments: Array<TournamentEntry> = [
        {
          UniqueIndex: 3649,
          Name: 'B-dgfhdfghdgfh',
          Level: 8,
          ExternalIndex: 'PANT-2021-HL-01',
          DateFrom: '2020-09-05T00:00:00.000Z',
          DateTo: '2020-09-06T00:00:00.000Z',
          RegistrationDate: '2020-09-01T00:00:00.000Z',
          Venue: {
            Name: 'Sokah',
            Street: 'A Einsteinlaan 50',
            Town: '2660 Hoboken',
          },
          SerieCount: 17,
          SerieEntries: [
            {
              UniqueIndex: 36459,
              Name: 'D OPEN',
            },
          ],
        },
      ];
      const tabtOutput: IGetTournamentsOutput = {
        TournamentCount: 1,
        TournamentEntries: tournaments,
      };

      const spyOnTabt = jest
        .spyOn(tabtService, 'GetTournamentsAsync')
        .mockResolvedValue(tabtOutput);
      const input = {
        Season: 18,
      };

      const result = await provider.getTournaments(input);

      expect(result).toEqual(tournaments);
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith(input);
    });
    it('should call the tabt service correctly and return an empty array if no tournament found', async () => {
      const tournaments = [];
      const spyOnTabt = jest
        .spyOn(tabtService, 'GetTournamentsAsync')
        .mockResolvedValue({
          TournamentCount: 0,
          TournamentEntries: tournaments,
        });
      const input = {
        Season: 18,
      };

      const result = await provider.getTournaments(input);

      expect(result).toEqual(tournaments);
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith(input);
    });
  });

  describe('registerToTournament', () => {
    it('should call the tabt service correctly and returns the register response', async () => {
      const expected = {
        Success: true,
        MessageCount: 1,
        MessageEntries: ['yo'],
      };
      const spyOnTabt = jest
        .spyOn(tabtService, 'TournamentRegisterAsync')
        .mockResolvedValue([expected, '', {}, null, null]);

      const input = {
        TournamentUniqueIndex: 123,
        SerieUniqueIndex: 1,
        PlayerUniqueIndex: [1234],
        Unregister: false,
        NotifyPlayer: true,
      };

      const result = await provider.registerToTournament(input);

      expect(result).toBe(expected);
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith(input);
    });
  });
});
