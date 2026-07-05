import { Injectable, Logger } from '@nestjs/common';
import {
  GetClubsInput,
  GetClubsOutput,
  GetClubTeamsInput,
  GetClubTeamsOutput,
  GetDivisionRankingInput,
  GetDivisionRankingOutput,
  GetDivisionsInput,
  GetMatchesInput,
  GetMatchesOutput,
  GetMatchSystemsInput,
  GetMatchSystemsOutput,
  GetMembersInput,
  GetPlayerCategoriesInput,
  GetPlayerCategoriesResponse,
  GetSeasonsInput,
  GetTournamentsInput,
  IGetDivisionsOutput,
  IGetMembersOutput,
  IGetSeasonsOutput,
  IGetTournamentsOutput,
  ITestInput,
  IUploadInput,
  IUploadOutput,
  TestOutput,
  TournamentRegisterInput,
  TournamentRegisterOutput,
} from '../../entity/tabt-soap/TabTAPI_Port';
import { TabtClientSwitchingService } from './tabt-client-switching.service';
import { CredentialsService } from './credentials.service';
import { CacheService, TTL_DURATION } from '@app/common';
import { DatabaseContextService } from '../context/database-context.service';
import { TabtException } from '../filter/tabt-exception';
import { createHash } from 'crypto';

@Injectable()
export class TabtClientService {
  private readonly logger = new Logger(TabtClientService.name);

  constructor(
    private readonly tabtClientSwitchingService: TabtClientSwitchingService,
    private readonly cacheService: CacheService,
    private readonly credentialsService: CredentialsService,
    private readonly databaseContextService: DatabaseContextService,
  ) {}

  private enrichBodyAndQueryWithCache<T>(
    prefix: string,
    input: any,
    operation: (operation: any, options: any, headers: any) => Promise<T>,
    ttl,
  ) {
    const enrichedInput =
      this.credentialsService.enrichInputWithCredentials(input);
    const cacheKey = TabtClientService.getCacheKey(
      prefix,
      enrichedInput,
      this.databaseContextService.database,
    );
    const getter: () => Promise<T> = async () => {
      try {
        return await operation(
          enrichedInput,
          null,
          this.credentialsService.extraHeaders,
        );
      } catch (e) {
        if (e.message) {
          this.logger.error(e, e.stack);
        }
        if (e?.root?.Envelope?.Body?.Fault?.faultcode) {
          this.logger.error(
            `Error calling tabt: ${e?.root?.Envelope?.Body?.Fault?.faultcode} ${e?.root?.Envelope?.Body?.Fault?.faultstring}`,
          );
          throw new TabtException(
            e?.root?.Envelope?.Body?.Fault?.faultcode,
            e?.root?.Envelope?.Body?.Fault?.faultstring,
          );
        }
        throw e;
      }
    };
    return this.cacheService.getFromCacheOrGetAndCacheResult(
      cacheKey,
      getter,
      ttl,
    );
  }

  TestAsync(
    input: ITestInput,
  ): Promise<[TestOutput, string, { [k: string]: any }, any, any]> {
    this.logger.debug('Request Test method');
    return this.tabtClientSwitchingService.tabtClient.TestAsync(
      this.credentialsService.enrichInputWithCredentials(input),
      null,
      this.credentialsService.extraHeaders,
    );
  }

  GetSeasonsAsync(input: GetSeasonsInput): Promise<IGetSeasonsOutput> {
    this.logger.debug('Request GetSeason method');
    const getter = async (input, options, headers) => {
      const [result] =
        await this.tabtClientSwitchingService.tabtClient.GetSeasonsAsync(
          input,
          options,
          headers,
        );
      return result;
    };
    return this.enrichBodyAndQueryWithCache(
      'season',
      input,
      getter,
      TTL_DURATION.ONE_DAY,
    );
  }

  GetClubTeamsAsync(input: GetClubTeamsInput): Promise<GetClubTeamsOutput> {
    this.logger.debug('Request GetClubTeams method');
    const getter = async (input, options, headers) => {
      const [result] =
        await this.tabtClientSwitchingService.tabtClient.GetClubTeamsAsync(
          input,
          options,
          headers,
        );
      return result;
    };
    return this.enrichBodyAndQueryWithCache(
      'club-teams',
      input,
      getter,
      TTL_DURATION.ONE_DAY,
    );
  }

  GetDivisionRankingAsync(
    input: GetDivisionRankingInput,
  ): Promise<GetDivisionRankingOutput> {
    this.logger.debug('Request GetDivisionRanking method');
    const getter = async (input, options, headers) => {
      const [result] =
        await this.tabtClientSwitchingService.tabtClient.GetDivisionRankingAsync(
          input,
          options,
          headers,
        );
      return result;
    };
    return this.enrichBodyAndQueryWithCache(
      'division-ranking',
      input,
      getter,
      TTL_DURATION.TWO_HOURS,
    );
  }

  GetMatchesAsync(input: GetMatchesInput): Promise<GetMatchesOutput> {
    this.logger.debug('Request GetMatchesAsync method', input);
    const getter = async (input, options, headers) => {
      const [result] =
        await this.tabtClientSwitchingService.tabtClient.GetMatchesAsync(
          input,
          options,
          headers,
        );
      return result;
    };
    return this.enrichBodyAndQueryWithCache(
      'matches',
      input,
      getter,
      TTL_DURATION.ONE_HOUR,
    );
  }

  GetMembersAsync(
    getMembersInput: GetMembersInput,
  ): Promise<IGetMembersOutput> {
    this.logger.debug('Request GetMembers method');
    const getter = async (input, options, headers) => {
      const [result] =
        await this.tabtClientSwitchingService.tabtClient.GetMembersAsync(
          input,
          options,
          headers,
        );
      return result;
    };
    return this.enrichBodyAndQueryWithCache(
      'members',
      getMembersInput,
      getter,
      TTL_DURATION.EIGHT_HOURS,
    );
  }

  GetMembersCategoriesAsync(
    getMembersInput: GetPlayerCategoriesInput,
  ): Promise<GetPlayerCategoriesResponse> {
    this.logger.debug('Request GetMembersCategories method');
    const getter = async (input, options, headers) => {
      const [result] =
        await this.tabtClientSwitchingService.tabtClient.GetPlayerCategoriesAsync(
          input,
          options,
          headers,
        );
      return result;
    };
    return this.enrichBodyAndQueryWithCache(
      'members-categories',
      getMembersInput,
      getter,
      TTL_DURATION.ONE_DAY * 2,
    );
  }

  UploadAsync(
    input: IUploadInput,
  ): Promise<[IUploadOutput, string, { [k: string]: any }, any, any]> {
    this.logger.debug('Request Test method');
    return this.tabtClientSwitchingService.tabtClient.UploadAsync(
      this.credentialsService.enrichInputWithCredentials(input),
      null,
      this.credentialsService.extraHeaders,
    );
  }

  GetClubsAsync(input: GetClubsInput): Promise<GetClubsOutput> {
    this.logger.debug('Request GetClubs method');
    const getter = async (input, options, headers) => {
      const [result] =
        await this.tabtClientSwitchingService.tabtClient.GetClubsAsync(
          input,
          options,
          headers,
        );
      return result;
    };
    return this.enrichBodyAndQueryWithCache(
      'clubs',
      input,
      getter,
      TTL_DURATION.ONE_DAY,
    );
  }

  GetDivisionsAsync(input: GetDivisionsInput): Promise<IGetDivisionsOutput> {
    this.logger.debug('Request GetDivisions method');
    const getter = async (input, options, headers) => {
      const [result] =
        await this.tabtClientSwitchingService.tabtClient.GetDivisionsAsync(
          input,
          options,
          headers,
        );
      return result;
    };
    return this.enrichBodyAndQueryWithCache(
      'divisions',
      input,
      getter,
      TTL_DURATION.ONE_DAY,
    );
  }

  GetTournamentsAsync(
    input: GetTournamentsInput,
  ): Promise<IGetTournamentsOutput> {
    this.logger.debug('Request Tournaments method');
    const getter = async (input, options, headers) => {
      const [result] =
        await this.tabtClientSwitchingService.tabtClient.GetTournamentsAsync(
          input,
          options,
          headers,
        );
      return result;
    };
    return this.enrichBodyAndQueryWithCache(
      'tournaments',
      input,
      getter,
      TTL_DURATION.EIGHT_HOURS,
    );
  }

  GetMatchSystemsAsync(
    input: GetMatchSystemsInput,
  ): Promise<GetMatchSystemsOutput> {
    this.logger.debug('Request GetMatchSystems method');
    const getter = async (input, options, headers) => {
      const [result] =
        await this.tabtClientSwitchingService.tabtClient.GetMatchSystemsAsync(
          input,
          options,
          headers,
        );
      return result;
    };
    return this.enrichBodyAndQueryWithCache(
      'match-systems',
      input,
      getter,
      TTL_DURATION.ONE_DAY,
    );
  }

  TournamentRegisterAsync(
    input: TournamentRegisterInput,
  ): Promise<
    [TournamentRegisterOutput, string, { [k: string]: any }, any, any]
  > {
    this.logger.debug('Request TournamentRegister method');
    return this.tabtClientSwitchingService.tabtClient.TournamentRegisterAsync(
      this.credentialsService.enrichInputWithCredentials(input),
      null,
      this.credentialsService.extraHeaders,
    );
  }

  private static getCacheKey(prefix: string, input: any, db: string): string {
    return `${prefix}-${db}:${createHash('sha256')
      .update(JSON.stringify(input ?? {}))
      .digest('hex')}`;
  }
}
