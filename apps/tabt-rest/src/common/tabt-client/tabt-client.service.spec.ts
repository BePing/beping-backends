import { Test } from '@nestjs/testing';
import { TabtClientSwitchingService } from './tabt-client-switching.service';
import {
  DatabaseContextService,
  TABT_DATABASE,
} from '../context/database-context.service';
import { TabtClientService } from './tabt-client.service';
import { PinoLogger } from 'nestjs-pino';
import { CredentialsService } from './credentials.service';
import { CacheService } from '@app/common';
import {
  GetClubsInput,
  GetClubsOutput,
  GetClubTeamsInput,
  GetDivisionRankingInput,
  GetDivisionRankingOutput,
  GetDivisionsInput,
  GetMatchesInput,
  GetMatchesOutput,
  GetMatchSystemsInput,
  GetMatchSystemsOutput,
  GetMembersInput,
  GetSeasonsInput,
  GetTournamentsInput,
  IGetDivisionsOutput,
  IGetMembersOutput,
  IGetTournamentsOutput,
  IUploadInput,
  TournamentRegisterInput,
} from '../../entity/tabt-soap/TabTAPI_Port';
import { HeaderKeys } from '../context/context.constants';
import { TabtException } from '../filter/tabt-exception';

jest.mock('../context/database-context.service');
jest.mock('./credentials.service');

describe('TabtClientService', () => {
  let service: TabtClientService;
  let cacheService: CacheService;
  let databaseContextService: DatabaseContextService;
  let credentialsService: CredentialsService;
  let tabtClientSwitchingService: TabtClientSwitchingService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TabtClientService,
        {
          provide: CacheService,
          useValue: {
            getFromCache: jest.fn(),
            setInCache: jest.fn(),
            getFromCacheOrGetAndCacheResult: jest.fn(),
          },
        },
        DatabaseContextService,
        CredentialsService,
        {
          provide: TabtClientSwitchingService,
          useValue: {
            tabtClient: {
              TestAsync: jest.fn(),
              GetSeasonsAsync: jest.fn(),
              GetClubTeamsAsync: jest.fn(),
              GetDivisionRankingAsync: jest.fn(),
              GetMatchesAsync: jest.fn(),
              GetMembersAsync: jest.fn(),
              UploadAsync: jest.fn(),
              GetClubsAsync: jest.fn(),
              GetDivisionsAsync: jest.fn(),
              GetTournamentsAsync: jest.fn(),
              GetMatchSystemsAsync: jest.fn(),
              TournamentRegisterAsync: jest.fn(),
            },
          },
        },
        {
          provide: PinoLogger,
          useValue: { setContext: jest.fn(), debug: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get<TabtClientService>(TabtClientService);
    cacheService = moduleRef.get<CacheService>(CacheService);
    databaseContextService = moduleRef.get<DatabaseContextService>(
      DatabaseContextService,
    );
    credentialsService = moduleRef.get<CredentialsService>(CredentialsService);
    tabtClientSwitchingService = moduleRef.get<TabtClientSwitchingService>(
      TabtClientSwitchingService,
    );

    Object.defineProperty(databaseContextService, 'database', {
      get() {
        return TABT_DATABASE.AFTT;
      },
    });

    Object.defineProperty(credentialsService, 'extraHeaders', {
      get() {
        return { [HeaderKeys.X_FORWARDED_FOR]: '12.12.12.12' };
      },
    });
  });

  it('should be initialized', () => {
    expect(service).toBeDefined();
  });

  describe('Operations', () => {
    it('should query the cache for TestAsync with the enriched input', async () => {
      const input = {};
      const enrichedInput = {
        Credentials: {
          Account: 'test',
          Password: 'test',
        },
        ...input,
      };
      const cacheSpy = jest.spyOn(
        cacheService,
        'getFromCacheOrGetAndCacheResult',
      );
      const operationSpy = jest.spyOn(
        tabtClientSwitchingService.tabtClient,
        'TestAsync',
      );
      const enrichSpy = jest
        .spyOn(credentialsService, 'enrichInputWithCredentials')
        .mockReturnValue(enrichedInput);

      await service.TestAsync(input);

      expect(cacheSpy).toHaveBeenCalledTimes(0);

      expect(enrichSpy).toHaveBeenCalledTimes(1);
      expect(enrichSpy).toHaveBeenCalledWith(input);
      expect(operationSpy).toHaveBeenCalledTimes(1);
      expect(operationSpy).toHaveBeenCalledWith(
        enrichedInput,
        null,
        expect.anything(),
      );
    });

    it('should return a TabtException if operation failed', async () => {
      const input = {};
      const enrichedInput = {
        Credentials: {
          Account: 'test',
          Password: 'test',
        },
        ...input,
      };
      const cacheSpy = jest.spyOn(
        cacheService,
        'getFromCacheOrGetAndCacheResult',
      );
      const error = new Error();
      error['root'] = {
        Envelope: {
          Body: {
            Fault: {
              faultcode: '12',
              faultstring: 'Bad error',
            },
          },
        },
      };
      jest
        .spyOn(credentialsService, 'enrichInputWithCredentials')
        .mockReturnValue(enrichedInput);
      jest
        .spyOn(tabtClientSwitchingService.tabtClient, 'GetSeasonsAsync')
        .mockRejectedValue(error);
      try {
        await service.GetSeasonsAsync(input);
        await cacheSpy.mock.calls[0][1]();

        throw new Error('Should have thrown error');
      } catch (e) {
        expect(e).toStrictEqual(new TabtException('12', 'Bad error'));
      }
    });

    it('should query the cache for GetSeasonsAsync with the enriched input', async () => {
      const input: GetSeasonsInput = {};
      const enrichedInput = {
        Credentials: {
          Account: 'test',
          Password: 'test',
        },
        ...input,
      };

      const cacheSpy = jest.spyOn(
        cacheService,
        'getFromCacheOrGetAndCacheResult',
      );
      const operationSpy = jest
        .spyOn(tabtClientSwitchingService.tabtClient, 'GetSeasonsAsync')
        .mockResolvedValue([
          { SeasonEntries: [], CurrentSeason: 18, CurrentSeasonName: '' },
          'test',
          {},
          null,
          null,
        ]);
      const enrichSpy = jest
        .spyOn(credentialsService, 'enrichInputWithCredentials')
        .mockReturnValue(enrichedInput);

      await service.GetSeasonsAsync(input);
      // Fake the cache calling the getter
      await cacheSpy.mock.calls[0][1]();

      expect(cacheSpy).toHaveBeenCalledTimes(1);
      expect(cacheSpy).toHaveBeenCalledWith(
        'season-aftt:3bc66823b8789b7c4d43e6da582c36d58fc078a7cac0c752ad1d796543241aaa',
        expect.any(Function),
        expect.any(Number),
      );
      expect(enrichSpy).toHaveBeenCalledTimes(1);
      expect(enrichSpy).toHaveBeenCalledWith(input);
      expect(operationSpy).toHaveBeenCalledTimes(1);
      expect(operationSpy).toHaveBeenCalledWith(
        enrichedInput,
        null,
        expect.anything(),
      );
    });

    it('should query the cache for GetClubTeamsAsync with the enriched input', async () => {
      const input: GetClubTeamsInput = {
        Club: 'L360',
      };
      const enrichedInput = {
        Credentials: {
          Account: 'test',
          Password: 'test',
        },
        ...input,
      };
      const cacheSpy = jest.spyOn(
        cacheService,
        'getFromCacheOrGetAndCacheResult',
      );

      const operationSpy = jest
        .spyOn(tabtClientSwitchingService.tabtClient, 'GetClubTeamsAsync')
        .mockResolvedValue([
          {
            ClubName: '',
            TeamCount: 0,
            TeamEntries: [],
          },
          '',
          {},
          null,
          null,
        ]);
      const enrichSpy = jest
        .spyOn(credentialsService, 'enrichInputWithCredentials')
        .mockReturnValue(enrichedInput);

      await service.GetClubTeamsAsync(input);
      // Fake the cache calling the getter
      await cacheSpy.mock.calls[0][1]();

      expect(cacheSpy).toHaveBeenCalledTimes(1);
      expect(cacheSpy).toHaveBeenCalledWith(
        'club-teams-aftt:3200c65833ed1c49f5a8ffbc8d3d39322b19d4c6f493679e7d8d2162d8858ced',
        expect.any(Function),
        expect.any(Number),
      );
      expect(enrichSpy).toHaveBeenCalledTimes(1);
      expect(enrichSpy).toHaveBeenCalledWith(input);
      expect(operationSpy).toHaveBeenCalledTimes(1);
      expect(operationSpy).toHaveBeenCalledWith(
        enrichedInput,
        null,
        expect.anything(),
      );
    });

    it('should query the cache for GetDivisionRankingAsync with the enriched input', async () => {
      const input: GetDivisionRankingInput = {
        DivisionId: 123,
        WeekName: '2',
      };
      const enrichedInput = {
        Credentials: {
          Account: 'test',
          Password: 'test',
        },
        ...input,
      };

      const cacheSpy = jest.spyOn(
        cacheService,
        'getFromCacheOrGetAndCacheResult',
      );
      const operationSpy = jest
        .spyOn(tabtClientSwitchingService.tabtClient, 'GetDivisionRankingAsync')
        .mockResolvedValue([
          {} as GetDivisionRankingOutput,
          '',
          {},
          null,
          null,
        ]);
      const enrichSpy = jest
        .spyOn(credentialsService, 'enrichInputWithCredentials')
        .mockReturnValue(enrichedInput);

      await service.GetDivisionRankingAsync(input);
      // Fake the cache calling the getter
      await cacheSpy.mock.calls[0][1]();

      expect(cacheSpy).toHaveBeenCalledTimes(1);
      expect(cacheSpy).toHaveBeenCalledWith(
        'division-ranking-aftt:175e29a17dfaa6a95c8fe88dbfa4106f77cc3e39617e28116531521de8777d17',
        expect.any(Function),
        expect.any(Number),
      );
      expect(enrichSpy).toHaveBeenCalledTimes(1);
      expect(enrichSpy).toHaveBeenCalledWith(input);
      expect(operationSpy).toHaveBeenCalledTimes(1);
      expect(operationSpy).toHaveBeenCalledWith(
        enrichedInput,
        null,
        expect.anything(),
      );
    });

    it('should query the cache for GetMatchesAsync with the enriched input', async () => {
      const input: GetMatchesInput = {};
      const enrichedInput = {
        Credentials: {
          Account: 'test',
          Password: 'test',
        },
        ...input,
      };

      const cacheSpy = jest.spyOn(
        cacheService,
        'getFromCacheOrGetAndCacheResult',
      );
      const operationSpy = jest
        .spyOn(tabtClientSwitchingService.tabtClient, 'GetMatchesAsync')
        .mockResolvedValue([{} as GetMatchesOutput, '', {}, null, null]);
      const enrichSpy = jest
        .spyOn(credentialsService, 'enrichInputWithCredentials')
        .mockReturnValue(enrichedInput);

      await service.GetMatchesAsync(input);
      // Fake the cache calling the getter
      await cacheSpy.mock.calls[0][1]();

      expect(cacheSpy).toHaveBeenCalledTimes(1);
      expect(cacheSpy).toHaveBeenCalledWith(
        'matches-aftt:3bc66823b8789b7c4d43e6da582c36d58fc078a7cac0c752ad1d796543241aaa',
        expect.any(Function),
        expect.any(Number),
      );
      expect(enrichSpy).toHaveBeenCalledTimes(1);
      expect(enrichSpy).toHaveBeenCalledWith(input);
      expect(operationSpy).toHaveBeenCalledTimes(1);
      expect(operationSpy).toHaveBeenCalledWith(
        enrichedInput,
        null,
        expect.anything(),
      );
    });
    it('should query the cache for GetMembersAsync with the enriched input', async () => {
      const input: GetMembersInput = {};
      const enrichedInput = {
        Credentials: {
          Account: 'test',
          Password: 'test',
        },
        ...input,
      };

      const cacheSpy = jest.spyOn(
        cacheService,
        'getFromCacheOrGetAndCacheResult',
      );
      const operationSpy = jest
        .spyOn(tabtClientSwitchingService.tabtClient, 'GetMembersAsync')
        .mockResolvedValue([{} as IGetMembersOutput, '', {}, null, null]);
      const enrichSpy = jest
        .spyOn(credentialsService, 'enrichInputWithCredentials')
        .mockReturnValue(enrichedInput);

      await service.GetMembersAsync(input);
      // Fake the cache calling the getter
      await cacheSpy.mock.calls[0][1]();

      expect(cacheSpy).toHaveBeenCalledTimes(1);
      expect(cacheSpy).toHaveBeenCalledWith(
        'members-aftt:3bc66823b8789b7c4d43e6da582c36d58fc078a7cac0c752ad1d796543241aaa',
        expect.any(Function),
        expect.any(Number),
      );
      expect(enrichSpy).toHaveBeenCalledTimes(1);
      expect(enrichSpy).toHaveBeenCalledWith(input);
      expect(operationSpy).toHaveBeenCalledTimes(1);
      expect(operationSpy).toHaveBeenCalledWith(
        enrichedInput,
        null,
        expect.anything(),
      );
    });

    it('should query the cache for UploadAsync with the enriched input', async () => {
      const input: IUploadInput = {
        Data: '123',
      };
      const enrichedInput = {
        Credentials: {
          Account: 'test',
          Password: 'test',
        },
        ...input,
      };

      const cacheSpy = jest.spyOn(
        cacheService,
        'getFromCacheOrGetAndCacheResult',
      );
      const operationSpy = jest.spyOn(
        tabtClientSwitchingService.tabtClient,
        'UploadAsync',
      );
      const enrichSpy = jest
        .spyOn(credentialsService, 'enrichInputWithCredentials')
        .mockReturnValue(enrichedInput);

      await service.UploadAsync(input);

      expect(cacheSpy).toHaveBeenCalledTimes(0);
      expect(enrichSpy).toHaveBeenCalledTimes(1);
      expect(enrichSpy).toHaveBeenCalledWith(input);
      expect(operationSpy).toHaveBeenCalledTimes(1);
      expect(operationSpy).toHaveBeenCalledWith(
        enrichedInput,
        null,
        expect.anything(),
      );
    });
    it('should query the cache for GetClubsAsync with the enriched input', async () => {
      const input: GetClubsInput = {};
      const enrichedInput = {
        Credentials: {
          Account: 'test',
          Password: 'test',
        },
        ...input,
      };

      const cacheSpy = jest.spyOn(
        cacheService,
        'getFromCacheOrGetAndCacheResult',
      );
      const operationSpy = jest
        .spyOn(tabtClientSwitchingService.tabtClient, 'GetClubsAsync')
        .mockResolvedValue([{} as GetClubsOutput, '', {}, null, null]);
      const enrichSpy = jest
        .spyOn(credentialsService, 'enrichInputWithCredentials')
        .mockReturnValue(enrichedInput);

      await service.GetClubsAsync(input);
      // Fake the cache calling the getter
      await cacheSpy.mock.calls[0][1]();

      expect(cacheSpy).toHaveBeenCalledTimes(1);
      expect(cacheSpy).toHaveBeenCalledWith(
        'clubs-aftt:3bc66823b8789b7c4d43e6da582c36d58fc078a7cac0c752ad1d796543241aaa',
        expect.any(Function),
        expect.any(Number),
      );
      expect(enrichSpy).toHaveBeenCalledTimes(1);
      expect(enrichSpy).toHaveBeenCalledWith(input);
      expect(operationSpy).toHaveBeenCalledTimes(1);
      expect(operationSpy).toHaveBeenCalledWith(
        enrichedInput,
        null,
        expect.anything(),
      );
    });

    it('should query the cache for GetDivisionsAsync with the enriched input', async () => {
      const input: GetDivisionsInput = {};
      const enrichedInput = {
        Credentials: {
          Account: 'test',
          Password: 'test',
        },
        ...input,
      };

      const cacheSpy = jest.spyOn(
        cacheService,
        'getFromCacheOrGetAndCacheResult',
      );
      const operationSpy = jest
        .spyOn(tabtClientSwitchingService.tabtClient, 'GetDivisionsAsync')
        .mockResolvedValue([{} as IGetDivisionsOutput, '', {}, null, null]);
      const enrichSpy = jest
        .spyOn(credentialsService, 'enrichInputWithCredentials')
        .mockReturnValue(enrichedInput);

      await service.GetDivisionsAsync(input);
      // Fake the cache calling the getter
      await cacheSpy.mock.calls[0][1]();

      expect(cacheSpy).toHaveBeenCalledTimes(1);
      expect(cacheSpy).toHaveBeenCalledWith(
        'divisions-aftt:3bc66823b8789b7c4d43e6da582c36d58fc078a7cac0c752ad1d796543241aaa',
        expect.any(Function),
        expect.any(Number),
      );
      expect(enrichSpy).toHaveBeenCalledTimes(1);
      expect(enrichSpy).toHaveBeenCalledWith(input);
      expect(operationSpy).toHaveBeenCalledTimes(1);
      expect(operationSpy).toHaveBeenCalledWith(
        enrichedInput,
        null,
        expect.anything(),
      );
    });

    it('should query the cache for GetTournamentsAsync with the enriched input', async () => {
      const input: GetTournamentsInput = {};
      const enrichedInput = {
        Credentials: {
          Account: 'test',
          Password: 'test',
        },
        ...input,
      };

      const cacheSpy = jest.spyOn(
        cacheService,
        'getFromCacheOrGetAndCacheResult',
      );
      const operationSpy = jest
        .spyOn(tabtClientSwitchingService.tabtClient, 'GetTournamentsAsync')
        .mockResolvedValue([{} as IGetTournamentsOutput, '', {}, null, null]);
      const enrichSpy = jest
        .spyOn(credentialsService, 'enrichInputWithCredentials')
        .mockReturnValue(enrichedInput);

      await service.GetTournamentsAsync(input);
      // Fake the cache calling the getter
      await cacheSpy.mock.calls[0][1]();

      expect(cacheSpy).toHaveBeenCalledTimes(1);
      expect(cacheSpy).toHaveBeenCalledWith(
        'tournaments-aftt:3bc66823b8789b7c4d43e6da582c36d58fc078a7cac0c752ad1d796543241aaa',
        expect.any(Function),
        expect.any(Number),
      );
      expect(enrichSpy).toHaveBeenCalledTimes(1);
      expect(enrichSpy).toHaveBeenCalledWith(input);
      expect(operationSpy).toHaveBeenCalledTimes(1);
      expect(operationSpy).toHaveBeenCalledWith(
        enrichedInput,
        null,
        expect.anything(),
      );
    });

    it('should query the cache for GetMatchSystemsAsync with the enriched input', async () => {
      const input: GetMatchSystemsInput = {};
      const enrichedInput = {
        Credentials: {
          Account: 'test',
          Password: 'test',
        },
        ...input,
      };

      const cacheSpy = jest.spyOn(
        cacheService,
        'getFromCacheOrGetAndCacheResult',
      );
      const operationSpy = jest
        .spyOn(tabtClientSwitchingService.tabtClient, 'GetMatchSystemsAsync')
        .mockResolvedValue([{} as GetMatchSystemsOutput, '', {}, null, null]);
      const enrichSpy = jest
        .spyOn(credentialsService, 'enrichInputWithCredentials')
        .mockReturnValue(enrichedInput);

      await service.GetMatchSystemsAsync(input);
      // Fake the cache calling the getter
      await cacheSpy.mock.calls[0][1]();

      expect(cacheSpy).toHaveBeenCalledTimes(1);
      expect(cacheSpy).toHaveBeenCalledWith(
        'match-systems-aftt:3bc66823b8789b7c4d43e6da582c36d58fc078a7cac0c752ad1d796543241aaa',
        expect.any(Function),
        expect.any(Number),
      );
      expect(enrichSpy).toHaveBeenCalledTimes(1);
      expect(enrichSpy).toHaveBeenCalledWith(input);
      expect(operationSpy).toHaveBeenCalledTimes(1);
      expect(operationSpy).toHaveBeenCalledWith(
        enrichedInput,
        null,
        expect.anything(),
      );
    });
    it('should go directly to tabt for TournamentRegisterAsync with the enriched input', async () => {
      const input: TournamentRegisterInput = {
        TournamentUniqueIndex: 1,
        SerieUniqueIndex: 1,
        PlayerUniqueIndex: [123],
        Unregister: false,
        NotifyPlayer: true,
      };
      const enrichedInput = {
        Credentials: {
          Account: 'test',
          Password: 'test',
        },
        ...input,
      };
      const cacheSpy = jest.spyOn(
        cacheService,
        'getFromCacheOrGetAndCacheResult',
      );
      const operationSpy = jest.spyOn(
        tabtClientSwitchingService.tabtClient,
        'TournamentRegisterAsync',
      );
      const enrichSpy = jest
        .spyOn(credentialsService, 'enrichInputWithCredentials')
        .mockReturnValue(enrichedInput);

      await service.TournamentRegisterAsync(input);

      expect(cacheSpy).toHaveBeenCalledTimes(0);

      expect(enrichSpy).toHaveBeenCalledTimes(1);
      expect(enrichSpy).toHaveBeenCalledWith(input);
      expect(operationSpy).toHaveBeenCalledTimes(1);
      expect(operationSpy).toHaveBeenCalledWith(
        enrichedInput,
        null,
        expect.anything(),
      );
    });
  });
});
