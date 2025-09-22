import { Client } from 'soap';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Level, PlayerCategory } from '../tabt-input.interface';
import { decode } from 'he';

export enum DivisionCategory {
  SENIOR_MEN = 37,
  SENIOR_WOMEN = 38,
  YOUTH = 41,
  YOUTH_WOMEN = 42,
}

export class Credentials {
  Account: string;

  Password: string;

  OnBehalfOf?: number;
}

/* tslint:disable:max-line-length no-empty-class */
export class ITestInput {
  Credentials?: Credentials;
}

export class VenueEntry {
  @ApiPropertyOptional()
  Id: number;

  @ApiPropertyOptional()
  ClubVenue: number;

  @ApiPropertyOptional()
  Name: string;

  @ApiPropertyOptional()
  Street: string;

  @ApiPropertyOptional()
  Town: string;

  @ApiPropertyOptional()
  Phone: string;

  @ApiPropertyOptional()
  Comment: string;

  @ApiPropertyOptional()
  Lat?: string;

  @ApiPropertyOptional()
  Lon?: string;

  @ApiPropertyOptional()
  BoundingBox?: string[];
}

export class TestOutput {
  /** xsd:string(undefined) */
  @ApiProperty()
  Timestamp: string;
  /** xsd:string(undefined) */
  @ApiProperty()
  ApiVersion: string;
  /** xsd:boolean(undefined) */
  @ApiProperty()
  IsValidAccount: boolean;
  /** SupportedLanguages(en,fr,nl) */
  @ApiProperty({ enum: ['en', 'fr', 'nl'] })
  Language: 'en' | 'fr' | 'nl';
  /** xsd:string(undefined) */
  @ApiProperty()
  Database: string;
  /** xsd:string(undefined) */
  @ApiProperty()
  RequestorIp: string;
  /** xsd:number(undefined) */
  @ApiProperty()
  ConsumedTicks: number;
  /** xsd:number(undefined) */
  @ApiProperty()
  CurrentQuota: number;
  /** xsd:number(undefined) */
  @ApiProperty()
  AllowedQuota: number;
  /** xsd:string(undefined) */
  @ApiProperty()
  PhpVersion?: string;
  /** xsd:string(undefined) */
  @ApiProperty()
  DbVersion?: string;
}

export class GetSeasonsInput {
  Credentials?: Credentials;
}

export class IGetSeasonsOutput {
  /** xsd:number(undefined) */
  CurrentSeason: number;
  /** xsd:string(undefined) */
  CurrentSeasonName: string;
  SeasonEntries: Array<SeasonEntry>;
}

export class GetClubTeamsInput {
  Credentials?: Credentials;
  /** xsd:string(undefined) */
  Club: string;
  /** xsd:number(undefined) */
  Season?: number;
}

export class GetClubTeamsOutput {
  /** xsd:string(undefined) */
  ClubName: string;
  /** xsd:number(undefined) */
  TeamCount: number;
  TeamEntries: Array<TeamEntry>;
}

export class GetDivisionRankingInput {
  Credentials?: Credentials;
  /** xsd:number(undefined) */
  DivisionId: number;
  /** xsd:string(undefined) */
  WeekName?: string;
  /** xsd:number(undefined) */
  RankingSystem?: number;
}

export class RankingEntry {
  @ApiProperty()
  Position: number;

  @ApiProperty()
  Team: string;

  @ApiProperty()
  GamesPlayed: number;

  @ApiProperty()
  GamesWon: number;

  @ApiProperty()
  GamesLost: number;

  @ApiProperty()
  GamesDraw: number;

  @ApiProperty()
  GamesWO: number;

  @ApiProperty()
  IndividualMatchesWon: number;

  @ApiProperty()
  IndividualMatchesLost: number;

  @ApiProperty()
  IndividualSetsWon: number;

  @ApiProperty()
  IndividualSetsLost: number;

  @ApiProperty()
  Points: number;

  @ApiProperty()
  TeamClub: string;
}

export class GetDivisionRankingOutput {
  /** xsd:string(undefined) */
  @ApiProperty()
  DivisionName: string;
  @ApiProperty({
    type: [RankingEntry],
  })
  RankingEntries: Array<RankingEntry>;
}

export class GetMatchesInput {
  Credentials?: Credentials;
  /** xsd:number(undefined) */
  DivisionId?: number;
  /** xsd:string(undefined) */
  Club?: string;
  /** xsd:string(undefined) */
  Team?: string;
  /** xsd:number(undefined) */
  DivisionCategory?: number;
  /** xsd:number(undefined) */
  Season?: number;
  WeekName?: string;
  /** xsd:number(undefined) */
  Level?: number;
  /** ShowDivisionNameType(no,yes,short) */
  ShowDivisionName?: 'no' | 'yes' | 'short';
  /** xsd:date(undefined) */
  YearDateFrom?: string;
  /** xsd:date(undefined) */
  YearDateTo?: string;
  /** xsd:boolean(undefined) */
  WithDetails?: boolean;
  /** xsd:string(undefined) */
  MatchId?: string;
  /** xsd:string(undefined) */
  MatchUniqueId?: number;
}

export class GetMatchesOutput {
  /** xsd:number(undefined) */
  MatchCount: number;
  TeamMatchesEntries: Array<TeamMatchesEntry>;
}

export class GetMembersInput {
  Credentials?: Credentials;
  /** xsd:string(undefined) */
  Club?: string;
  /** xsd:number(undefined) */
  Season?: number;
  /** xsd:number(undefined) */
  PlayerCategory?: number;
  /** xsd:number(undefined) */
  UniqueIndex?: number;
  /** xsd:string(undefined) */
  NameSearch?: string;
  /** xsd:boolean(undefined) */
  ExtendedInformation?: boolean;
  /** xsd:boolean(undefined) */
  RankingPointsInformation?: boolean;
  /** xsd:boolean(undefined) */
  WithResults?: boolean;
  /** xsd:boolean(undefined) */
  WithOpponentRankingEvaluation?: boolean;
}

export class IGetMembersOutput {
  /** xsd:number(undefined) */
  MemberCount: number;
  MemberEntries: Array<MemberEntry>;
}

export class IUploadInput {
  Credentials?: Credentials;
  /** xsd:string(undefined) */
  Data: string;
}

export class IUploadOutput {
  /** xsd:boolean(undefined) */
  Result: boolean;
  /** xsd:string(undefined) */
  ErrorLines: Array<string>;
}

export class GetClubsInput {
  Credentials?: Credentials;
  /** xsd:number(undefined) */
  Season?: number;
  /** xsd:number(undefined) */
  ClubCategory?: number;
  /** xsd:string(undefined) */
  Club?: string;
}

export class GetClubsOutput {
  /** xsd:number(undefined) */
  ClubCount: number;
  ClubEntries: Array<ClubEntry>;
}

export class GetDivisionsInput {
  Credentials?: Credentials;
  /** xsd:number(undefined) */
  Season?: number;
  /** xsd:number(undefined) */
  Level?: number;
  /** ShowDivisionNameType(no,yes,short) */
  ShowDivisionName?: 'no' | 'yes' | 'short';
}

export class IGetDivisionsOutput {
  /** xsd:number(undefined) */
  DivisionCount: number;
  DivisionEntries: Array<DivisionEntry>;
}

export class GetTournamentsInput {
  Credentials?: Credentials;

  Season?: number;

  TournamentUniqueIndex?: number;

  WithResults?: boolean;

  WithRegistrations?: boolean;
}

export class IGetTournamentsOutput {
  /** xsd:number(undefined) */
  TournamentCount: number;
  TournamentEntries: Array<TournamentEntry>;
}

export class GetMatchSystemsInput {
  Credentials?: Credentials;
  /** xsd:number(undefined) */
  UniqueIndex?: number;
}

export class GetMatchSystemsOutput {
  /** xsd:number(undefined) */
  MatchSystemCount: number;
  MatchSystemEntries?: Array<MatchSystemEntry>;
}

export class TournamentRegisterInput {
  Credentials?: Credentials;
  /** xsd:number(undefined) */
  TournamentUniqueIndex: number;
  /** xsd:number(undefined) */
  SerieUniqueIndex: number;
  /** xsd:number(undefined) */
  PlayerUniqueIndex: Array<number>;
  /** xsd:boolean(undefined) */
  Unregister: boolean;
  /** xsd:boolean(undefined) */
  NotifyPlayer: boolean;
}

export class TournamentRegisterOutput {
  @ApiProperty()
  Success: boolean;

  @ApiProperty()
  MessageCount: number;

  @ApiProperty()
  MessageEntries: Array<string>;
}

export class GetPlayerCategoriesInput {
  /** Credentials */
  Credentials?: Credentials;
  /** xsd:integer */
  Season?: string;
  /** xsd:integer */
  UniqueIndex?: string;
  /** xsd:string */
  ShortNameSearch?: string;
  /** xsd:integer */
  RankingCategory?: string;
}

export class GetPlayerCategoriesResponse {
  /** xsd:integer */
  @ApiProperty()
  PlayerCategoryCount?: number;
  /** PlayerCategoryEntries[] */
  @ApiProperty()
  PlayerCategoryEntries?: Array<PlayerCategoryEntries>;
}

export class PlayerCategoryEntries {
  /** xsd:integer */
  @ApiProperty()
  UniqueIndex?: string;
  /** xsd:string */
  @ApiProperty()
  Name?: string;
  /** xsd:string */
  @ApiProperty()
  ShortName?: string;
  /** xsd:integer */
  @ApiProperty()
  RankingCategory?: string;
  /** xsd:boolean */
  @ApiProperty()
  IsGroup?: string;
  /** xsd:string */
  @ApiProperty()
  GroupMembers?: string;
  /** xsd:string */
  @ApiProperty()
  Sex?: string;
  /** xsd:string */
  @ApiProperty()
  StrictSex?: string;
  /** xsd:integer */
  @ApiProperty()
  MinimumAge?: string;
  /** xsd:integer */
  @ApiProperty()
  MaximumAge?: string;
  /** xsd:integer */
  @ApiProperty()
  StrictMinimumAge?: string;
  /** xsd:integer */
  @ApiProperty()
  StrictMaximumAge?: string;
}

export class TabTAPISoap extends Client {
  Test: (
    input: ITestInput,
    cb: (
      err: any | null,
      result: TestOutput,
      raw: string,
      soapHeader: { [k: string]: any },
    ) => any,
    options?: any,
    extraHeaders?: any,
  ) => void;
  GetSeasons: (
    input: GetSeasonsInput,
    cb: (
      err: any | null,
      result: IGetSeasonsOutput,
      raw: string,
      soapHeader: { [k: string]: any },
    ) => any,
    options?: any,
    extraHeaders?: any,
  ) => void;
  GetClubTeams: (
    input: GetClubTeamsInput,
    cb: (
      err: any | null,
      result: GetClubTeamsOutput,
      raw: string,
      soapHeader: { [k: string]: any },
    ) => any,
    options?: any,
    extraHeaders?: any,
  ) => void;
  GetDivisionRanking: (
    input: GetDivisionRankingInput,
    cb: (
      err: any | null,
      result: GetDivisionRankingOutput,
      raw: string,
      soapHeader: { [k: string]: any },
    ) => any,
    options?: any,
    extraHeaders?: any,
  ) => void;
  GetMatches: (
    input: GetMatchesInput,
    cb: (
      err: any | null,
      result: GetMatchesOutput,
      raw: string,
      soapHeader: { [k: string]: any },
    ) => any,
    options?: any,
    extraHeaders?: any,
  ) => void;
  GetMembers: (
    input: GetMembersInput,
    cb: (
      err: any | null,
      result: IGetMembersOutput,
      raw: string,
      soapHeader: { [k: string]: any },
    ) => any,
    options?: any,
    extraHeaders?: any,
  ) => void;
  Upload: (
    input: IUploadInput,
    cb: (
      err: any | null,
      result: IUploadOutput,
      raw: string,
      soapHeader: { [k: string]: any },
    ) => any,
    options?: any,
    extraHeaders?: any,
  ) => void;
  GetClubs: (
    input: GetClubsInput,
    cb: (
      err: any | null,
      result: GetClubsOutput,
      raw: string,
      soapHeader: { [k: string]: any },
    ) => any,
    options?: any,
    extraHeaders?: any,
  ) => void;
  GetDivisions: (
    input: GetDivisionsInput,
    cb: (
      err: any | null,
      result: IGetDivisionsOutput,
      raw: string,
      soapHeader: { [k: string]: any },
    ) => any,
    options?: any,
    extraHeaders?: any,
  ) => void;
  GetTournaments: (
    input: GetTournamentsInput,
    cb: (
      err: any | null,
      result: IGetTournamentsOutput,
      raw: string,
      soapHeader: { [k: string]: any },
    ) => any,
    options?: any,
    extraHeaders?: any,
  ) => void;
  GetMatchSystems: (
    input: GetMatchSystemsInput,
    cb: (
      err: any | null,
      result: GetMatchSystemsOutput,
      raw: string,
      soapHeader: { [k: string]: any },
    ) => any,
    options?: any,
    extraHeaders?: any,
  ) => void;
  TournamentRegister: (
    input: TournamentRegisterInput,
    cb: (
      err: any | null,
      result: TournamentRegisterOutput,
      raw: string,
      soapHeader: { [k: string]: any },
    ) => any,
    options?: any,
    extraHeaders?: any,
  ) => void;
  GetPlayerCategories: (
    input: GetPlayerCategoriesInput,
    cb: (
      err: any | null,
      result: GetPlayerCategoriesResponse,
      raw: string,
      soapHeader: { [k: string]: any },
    ) => any,
    options?: any,
    extraHeaders?: any,
  ) => void;

  TestAsync: (
    input: ITestInput,
    option?: any,
    headers?: { [k: string]: string },
  ) => Promise<[TestOutput, string, { [k: string]: any }, any, any]>;
  GetSeasonsAsync: (
    input: GetSeasonsInput,
    option?: any,
    headers?: { [k: string]: string },
  ) => Promise<[IGetSeasonsOutput, string, { [k: string]: any }, any, any]>;
  GetClubTeamsAsync: (
    input: GetClubTeamsInput,
    option?: any,
    headers?: { [k: string]: string },
  ) => Promise<[GetClubTeamsOutput, string, { [k: string]: any }, any, any]>;
  GetDivisionRankingAsync: (
    input: GetDivisionRankingInput,
    option?: any,
    headers?: { [k: string]: string },
  ) => Promise<
    [GetDivisionRankingOutput, string, { [k: string]: any }, any, any]
  >;
  GetMatchesAsync: (
    input: GetMatchesInput,
    option?: any,
    headers?: { [k: string]: string },
  ) => Promise<[GetMatchesOutput, string, { [k: string]: any }, any, any]>;
  GetMembersAsync: (
    input: GetMembersInput,
    option?: any,
    headers?: { [k: string]: string },
  ) => Promise<[IGetMembersOutput, string, { [k: string]: any }, any, any]>;
  UploadAsync: (
    input: IUploadInput,
    option?: any,
    headers?: { [k: string]: string },
  ) => Promise<[IUploadOutput, string, { [k: string]: any }, any, any]>;
  GetClubsAsync: (
    input: GetClubsInput,
    option?: any,
    headers?: { [k: string]: string },
  ) => Promise<[GetClubsOutput, string, { [k: string]: any }, any, any]>;
  GetDivisionsAsync: (
    input: GetDivisionsInput,
    option?: any,
    headers?: { [k: string]: string },
  ) => Promise<
    [
      result: IGetDivisionsOutput,
      raw: string,
      soapHeader: { [k: string]: any },
      options: any,
      extraHeaders: any,
    ]
  >;
  GetTournamentsAsync: (
    input: GetTournamentsInput,
    option?: any,
    headers?: { [k: string]: string },
  ) => Promise<[IGetTournamentsOutput, string, { [k: string]: any }, any, any]>;
  GetMatchSystemsAsync: (
    input: GetMatchSystemsInput,
    option?: any,
    headers?: { [k: string]: string },
  ) => Promise<[GetMatchSystemsOutput, string, { [k: string]: any }, any, any]>;
  TournamentRegisterAsync: (
    input: TournamentRegisterInput,
    option?: any,
    headers?: { [k: string]: string },
  ) => Promise<
    [TournamentRegisterOutput, string, { [k: string]: any }, any, any]
  >;
  GetPlayerCategoriesAsync: (
    input: GetPlayerCategoriesInput,
    option?: any,
    headers?: { [k: string]: string },
  ) => Promise<
    [GetPlayerCategoriesResponse, string, { [k: string]: any }, any, any]
  >;
}

export class SeasonEntry {
  @ApiProperty()
  Season: number;

  @ApiProperty()
  Name: string;

  @ApiProperty()
  IsCurrent: boolean;
}

export class TeamEntry {
  TeamId: string;
  Team: string;
  DivisionId: number;
  DivisionName: string;
  DivisionCategory: number;
  MatchType: number;
}

export class Player {
  @ApiProperty()
  Position: number;

  @ApiProperty()
  UniqueIndex: number;

  @ApiProperty()
  FirstName: string;

  @ApiProperty()
  LastName: string;

  @ApiProperty()
  Ranking: string;

  @ApiPropertyOptional()
  VictoryCount: number;

  @ApiPropertyOptional()
  IsForfeited?: boolean;
}

export class DoubleTeam {
  @ApiProperty()
  Position: number;

  @ApiProperty()
  Team: string;

  @ApiProperty()
  IsForfeited: boolean;
}

export class Players {
  @ApiProperty()
  PlayerCount: number;

  @ApiProperty()
  DoubleTeamCount: number;

  @ApiPropertyOptional({ type: [Player] })
  Players: Array<Player>;

  @ApiPropertyOptional({ type: [DoubleTeam] })
  DoubleTeams: Array<DoubleTeam>;
}

export class IAwayPlayer {
  Position: number;

  UniqueIndex: number;

  FirstName: string;

  LastName: string;

  Ranking: string;

  VictoryCount: number;

  IsForfeited: boolean;
}

export class IndividualMatchResult {
  @ApiProperty()
  Position: number;

  @ApiProperty({
    type: [Number],
  })
  HomePlayerMatchIndex: Array<number>;

  @ApiProperty({
    type: [Number],
  })
  HomePlayerUniqueIndex: Array<number>;

  @ApiProperty({
    type: [Number],
  })
  AwayPlayerMatchIndex: Array<number>;

  @ApiProperty({
    type: [Number],
  })
  AwayPlayerUniqueIndex: Array<number>;

  @ApiProperty()
  HomeSetCount: number;

  @ApiProperty()
  AwaySetCount: number;

  @ApiPropertyOptional()
  IsHomeForfeited: boolean;

  @ApiPropertyOptional()
  IsAwayForfeited: boolean;

  @ApiPropertyOptional()
  Scores: string;
}

export class RankingPointsEntry {
  @ApiProperty()
  MethodName: string;

  @ApiProperty()
  Value: string;

  @ApiProperty()
  LastModified: string;
}

export class Phone {
  @ApiProperty()
  Home: string;

  @ApiProperty()
  Work: string;

  @ApiProperty()
  Mobile: string;

  @ApiProperty()
  Fax: string;
}

export class Address {
  @ApiProperty()
  Line1: string;

  @ApiProperty()
  Line2: string;

  @ApiProperty()
  ZipCode: number;

  @ApiProperty()
  Town: string;
}

export class RankingEvaluationEntry {
  @ApiProperty()
  EvaluationType: string;

  @ApiProperty()
  EvaluationValue: string;
}

export class CommentAuthor {
  @ApiPropertyOptional()
  Position: number;

  @ApiPropertyOptional()
  UniqueIndex: number;

  @ApiPropertyOptional()
  RankingIndex: number;

  @ApiPropertyOptional()
  FirstName: string;

  @ApiPropertyOptional()
  LastName: string;

  @ApiPropertyOptional()
  Ranking: string;

  @ApiPropertyOptional()
  Status: string;

  @ApiPropertyOptional()
  Club: string;
  /** http://api.frenoy.net/TabTAPI#GenderType(M,F) */
  @ApiPropertyOptional()
  Gender: 'M' | 'F';

  Category: string;
  /** http://api.frenoy.net/TabTAPI#xsd:date(undefined) */
  BirthDate: string;

  MedicalAttestation: boolean;

  RankingPointsCount: number;
  RankingPointsEntries: Array<RankingPointsEntry>;

  Email: string;
  Phone: Phone;
  Address: Address;

  ResultCount: number;
  ResultEntries: Array<{
    /** http://api.frenoy.net/TabTAPI#xsd:date(undefined) */
    Date: string;

    UniqueIndex: number;

    FirstName: string;

    LastName: string;

    Ranking: string;
    /** http://api.frenoy.net/TabTAPI#ResultType(V,D) */
    Result: 'V' | 'D';

    SetFor: number;

    SetAgainst: number;
    /** http://api.frenoy.net/TabTAPI#CompetitionType(C,T) */
    CompetitionType: 'C' | 'T';

    Club: string;

    MatchId: string;

    TournamentName: string;

    TournamentSerieName: string;

    TeamName: string;

    RankingEvaluationCount: number;
    RankingEvaluationEntries: Array<RankingEvaluationEntry>;
  }>;

  NationalNumber: string;
}

export class CommentEntry {
  @ApiPropertyOptional()
  Timestamp: string;

  @ApiPropertyOptional()
  Author: CommentAuthor;

  @ApiPropertyOptional()
  Comment: string;

  @ApiPropertyOptional()
  Code: string;
}

export class MatchDetails {
  @ApiProperty()
  DetailsCreated: boolean;
  /** http://api.frenoy.net/TabTAPI#xsd:time(undefined) */
  @ApiPropertyOptional()
  StartTime: string;
  /** http://api.frenoy.net/TabTAPI#xsd:time(undefined) */
  @ApiPropertyOptional()
  EndTime: string;

  @ApiPropertyOptional()
  HomeCaptain: number;

  @ApiPropertyOptional()
  AwayCaptain: number;

  @ApiPropertyOptional()
  Referee: number;

  @ApiPropertyOptional()
  HallCommissioner: number;

  @ApiProperty({
    type: Players,
  })
  HomePlayers: Players;

  @ApiProperty({
    type: Players,
  })
  AwayPlayers: Players;

  @ApiProperty({ type: [IndividualMatchResult] })
  IndividualMatchResults: Array<IndividualMatchResult>;

  @ApiProperty()
  MatchSystem: number;

  @ApiProperty()
  HomeScore: number;

  @ApiProperty()
  AwayScore: number;

  @ApiProperty()
  CommentCount: number;
  @ApiPropertyOptional({ type: CommentEntry, isArray: true })
  CommentEntries: Array<CommentEntry>;
}

export class TeamMatchesEntry {
  @ApiPropertyOptional()
  DivisionName?: string;

  @ApiProperty()
  MatchId: string;

  @ApiProperty()
  WeekName: string;
  /** http://api.frenoy.net/TabTAPI#xsd:date(undefined) */
  @ApiPropertyOptional()
  Date: string;
  /** http://api.frenoy.net/TabTAPI#xsd:time(undefined) */
  @ApiPropertyOptional()
  Time: string;

  @ApiPropertyOptional()
  Venue: number;

  @ApiPropertyOptional()
  VenueClub: string;

  @ApiPropertyOptional({ type: VenueEntry })
  VenueEntry: Omit<VenueEntry, 'ClubVenue' | 'Id'>;

  @ApiProperty()
  HomeClub: string;

  @ApiProperty()
  HomeTeam: string;

  @ApiProperty()
  AwayClub: string;

  @ApiProperty()
  AwayTeam: string;

  @ApiPropertyOptional()
  Score: string;

  @ApiPropertyOptional()
  MatchUniqueId: number;

  @ApiPropertyOptional()
  NextWeekName?: string;

  @ApiPropertyOptional()
  PreviousWeekName?: string;

  @ApiProperty()
  IsHomeForfeited: boolean;

  @ApiProperty()
  IsAwayForfeited: boolean;

  @ApiPropertyOptional()
  MatchDetails?: MatchDetails;

  @ApiProperty()
  DivisionId: number;

  @ApiProperty()
  DivisionCategory: number;

  @ApiProperty({ type: Boolean })
  IsHomeWithdrawn: boolean;

  @ApiProperty({ type: Boolean })
  IsAwayWithdrawn: boolean;

  @ApiProperty()
  IsValidated: boolean;

  @ApiProperty()
  IsLocked: boolean;

  constructor(partial: Partial<TeamMatchesEntry>) {
    Object.assign(this, partial);
    this.IsAwayWithdrawn =
      (partial.IsAwayWithdrawn as unknown as string) !== 'N';

    this.IsHomeWithdrawn =
      (partial.IsHomeWithdrawn as unknown as string) !== 'N';
  }
}

export class MemberEntryResultEntry {
  /** http://api.frenoy.net/TabTAPI#xsd:date(undefined) */
  @ApiProperty()
  Date: string;

  @ApiProperty()
  UniqueIndex: number;

  @ApiProperty()
  FirstName: string;

  @ApiProperty()
  LastName: string;

  @ApiProperty()
  Ranking: string;
  /** http://api.frenoy.net/TabTAPI#ResultType(V,D) */
  @ApiProperty()
  Result: 'V' | 'D';

  @ApiProperty()
  SetFor: number;

  @ApiProperty()
  SetAgainst: number;
  /** http://api.frenoy.net/TabTAPI#CompetitionType(C,T) */
  @ApiProperty({ enum: ['C', 'T'] })
  CompetitionType: 'C' | 'T';

  @ApiProperty()
  Club: string;

  @ApiPropertyOptional()
  MatchId: string;

  @ApiPropertyOptional()
  MatchUniqueId: number;

  @ApiPropertyOptional()
  TournamentName: string;

  @ApiPropertyOptional()
  TournamentSerieName: string;

  @ApiPropertyOptional()
  TeamName: string;

  @ApiPropertyOptional()
  RankingEvaluationCount: number;
  @ApiPropertyOptional({ type: [RankingEvaluationEntry] })
  RankingEvaluationEntries: Array<RankingEvaluationEntry>;
}

export class MemberEntry {
  @ApiProperty()
  Position: number;

  @ApiProperty()
  UniqueIndex: number;

  @ApiProperty()
  RankingIndex: number;

  @ApiProperty()
  FirstName: string;

  @ApiProperty()
  LastName: string;

  @ApiProperty()
  Ranking: string;

  @ApiProperty()
  Status: string;

  @ApiProperty()
  Club: string;
  /** http://api.frenoy.net/TabTAPI#GenderType(M,F) */
  @ApiPropertyOptional()
  Gender?: 'M' | 'F';

  @ApiPropertyOptional()
  Category?: string;
  /** http://api.frenoy.net/TabTAPI#xsd:date(undefined) */
  @ApiPropertyOptional()
  BirthDate?: string;

  @ApiPropertyOptional()
  MedicalAttestation?: boolean;

  @ApiPropertyOptional()
  RankingPointsCount?: number;
  @ApiPropertyOptional({ type: [RankingPointsEntry] })
  RankingPointsEntries?: Array<RankingPointsEntry>;

  @ApiPropertyOptional()
  Email?: string;
  @ApiPropertyOptional()
  Phone?: Phone;
  @ApiPropertyOptional()
  Address?: Address;

  @ApiPropertyOptional()
  ResultCount?: number;

  @ApiPropertyOptional({ type: [MemberEntryResultEntry] })
  ResultEntries?: Array<MemberEntryResultEntry>;

  @ApiPropertyOptional()
  NationalNumber?: string;
}

export class ClubEntry {
  @ApiProperty()
  UniqueIndex: string;

  @ApiProperty()
  Name: string;

  @ApiProperty()
  LongName: string;

  @ApiProperty()
  Category: number;

  @ApiProperty()
  @Transform(({ value }) => decode(value), { toPlainOnly: true })
  CategoryName: string;

  @ApiProperty()
  VenueCount: number;

  @ApiProperty({ type: [VenueEntry] })
  VenueEntries?: Array<VenueEntry>;

  constructor(partial: Partial<ClubEntry>) {
    Object.assign(this, partial);
  }
}

export class DivisionEntry {
  DivisionId: number;
  DivisionName: string;
  DivisionCategory: number;
  Level: number;
  MatchType: number;
  PlayerCategory: number;
}

export class RegistrationEntry {
  @ApiProperty()
  UniqueIndex: number;

  @ApiProperty()
  RegistrationDate: string;

  @ApiProperty()
  Member: MemberEntry;

  @ApiProperty()
  Club: ClubEntry;
}

export class TournamentSerieResultEntry {
  @ApiProperty()
  Position: number;

  @ApiProperty()
  HomePlayerMatchIndex: Array<number>;

  @ApiProperty()
  HomePlayerUniqueIndex: Array<number>;

  @ApiProperty()
  AwayPlayerMatchIndex: Array<number>;

  @ApiProperty()
  AwayPlayerUniqueIndex: Array<number>;

  @ApiProperty()
  HomeSetCount: number;

  @ApiProperty()
  AwaySetCount: number;

  @ApiProperty()
  IsHomeForfeited: boolean;
  @ApiProperty()
  IsAwayForfeited: boolean;

  @ApiProperty()
  Scores: string;

  @ApiProperty({ type: [Player] })
  HomePlayer: Array<Player>;

  @ApiProperty({ type: [Player] })
  AwayPlayer: Array<Player>;
}

export class TournamentSerieEntry {
  @ApiProperty()
  UniqueIndex: number;

  @ApiProperty()
  Name: string;

  @ApiPropertyOptional()
  ResultCount?: number;

  @ApiPropertyOptional({ type: [TournamentSerieResultEntry] })
  ResultEntries?: Array<TournamentSerieResultEntry>;

  @ApiPropertyOptional()
  RegistrationCount?: number;

  @ApiPropertyOptional({ type: [RegistrationEntry] })
  RegistrationEntries?: Array<RegistrationEntry>;
}

export class TournamentEntry {
  @ApiProperty()
  UniqueIndex: number;

  @ApiProperty()
  Name: string;

  @ApiProperty({ enum: Level })
  @Transform((l) => Level[l.value], { toPlainOnly: true })
  Level: number;

  @ApiProperty()
  ExternalIndex: string;
  /** http://api.frenoy.net/TabTAPI#xsd:date(undefined) */
  @ApiPropertyOptional()
  DateFrom: string;
  /** http://api.frenoy.net/TabTAPI#xsd:date(undefined) */
  @ApiPropertyOptional()
  DateTo: string;
  /** http://api.frenoy.net/TabTAPI#xsd:date(undefined) */
  @ApiPropertyOptional()
  RegistrationDate: string;

  @ApiPropertyOptional()
  Venue?: Pick<
    VenueEntry,
    'Name' | 'Street' | 'Town' | 'BoundingBox' | 'Lat' | 'Lon'
  >;

  @ApiPropertyOptional()
  SerieCount: number;

  @ApiPropertyOptional({ type: [TournamentSerieEntry] })
  SerieEntries: Array<TournamentSerieEntry>;

  constructor(partial: Partial<TournamentEntry>) {
    Object.assign(this, partial);
  }
}

export class TeamMatchDefinitionEntry {
  @ApiProperty()
  Position: number;

  @ApiProperty()
  Type: number;

  @ApiProperty()
  HomePlayerIndex: number;

  @ApiProperty()
  AwayPlayerIndex: number;

  @ApiPropertyOptional()
  AllowSubstitute?: boolean;
}

export class MatchSystemEntry {
  @ApiProperty()
  UniqueIndex: number;

  @ApiProperty()
  Name: string;

  @ApiProperty()
  SingleMatchCount: number;

  @ApiProperty()
  DoubleMatchCount: number;

  @ApiProperty()
  SetCount: number;

  @ApiProperty()
  PointCount: number;

  @ApiProperty()
  ForcedDoubleTeams: boolean;

  @ApiProperty()
  SubstituteCount: number;

  @ApiProperty()
  TeamMatchCount: number;

  @ApiProperty()
  TeamMatchDefinitionEntries: Array<TeamMatchDefinitionEntry>;
}
