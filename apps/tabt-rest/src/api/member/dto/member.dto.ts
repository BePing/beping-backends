import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PlayerCategory } from '../../../entity/tabt-input.interface';
import { RequestBySeasonDto } from '../../../common/dto/request-by-season.dto';
import {
  MemberEntry,
  RankingPointsEntry,
  Phone,
  Address,
  RankingEvaluationEntry,
  MemberEntryResultEntry,
  GetPlayerCategoriesResponse,
  PlayerCategoryEntries,
} from '../../../entity/tabt-soap/TabTAPI_Port';
import { PlayerCategoryDTO } from '../../../common/dto/player-category.dto';

export class BaseGetMembersV1 {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  club?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((id) => parseInt(id.value), { toClassOnly: true })
  uniqueIndex?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nameSearch?: string;

  @ApiPropertyOptional()
  @Transform((a) => Boolean(a.value))
  @IsBoolean()
  @IsOptional()
  extendedInformation?: boolean;

  @ApiPropertyOptional()
  @Transform((a) => Boolean(a.value))
  @IsBoolean()
  @IsOptional()
  rankingPointsInformation?: boolean;

  @ApiPropertyOptional()
  @Transform((a) => a.value === 'true')
  @IsBoolean()
  @IsOptional()
  withResults?: boolean;

  @ApiPropertyOptional()
  @Transform((a) => Boolean(a.value))
  @IsBoolean()
  @IsOptional()
  withOpponentRankingEvaluation?: boolean;
}

export class GetMembersV1 extends BaseGetMembersV1 {
  @ApiPropertyOptional({ enum: PlayerCategoryDTO })
  @IsOptional()
  @IsEnum(PlayerCategoryDTO)
  playerCategory?: PlayerCategoryDTO;
}

export class GetMemberV1 extends OmitType(GetMembersV1, ['uniqueIndex']) {}

export class RankingPointsEntryDTOV1 {
  @ApiProperty()
  MethodName: string;

  @ApiProperty()
  Value: string;

  @ApiProperty()
  LastModified: string;

  static fromTabT(entry: RankingPointsEntry): RankingPointsEntryDTOV1 {
    const dto = new RankingPointsEntryDTOV1();
    dto.MethodName = entry.MethodName;
    dto.Value = entry.Value;
    dto.LastModified = entry.LastModified;
    return dto;
  }
}

export class PhoneDTOV1 {
  @ApiProperty()
  Home: string;

  @ApiProperty()
  Work: string;

  @ApiProperty()
  Mobile: string;

  @ApiProperty()
  Fax: string;

  static fromTabT(phone: Phone): PhoneDTOV1 {
    const dto = new PhoneDTOV1();
    dto.Home = phone.Home;
    dto.Work = phone.Work;
    dto.Mobile = phone.Mobile;
    dto.Fax = phone.Fax;
    return dto;
  }
}

export class AddressDTOV1 {
  @ApiProperty()
  Line1: string;

  @ApiProperty()
  Line2: string;

  @ApiProperty()
  ZipCode: number;

  @ApiProperty()
  Town: string;

  static fromTabT(address: Address): AddressDTOV1 {
    const dto = new AddressDTOV1();
    dto.Line1 = address.Line1;
    dto.Line2 = address.Line2;
    dto.ZipCode = address.ZipCode;
    dto.Town = address.Town;
    return dto;
  }
}

export class RankingEvaluationEntryDTOV1 {
  @ApiProperty()
  EvaluationType: string;

  @ApiProperty()
  EvaluationValue: string;

  static fromTabT(entry: RankingEvaluationEntry): RankingEvaluationEntryDTOV1 {
    const dto = new RankingEvaluationEntryDTOV1();
    dto.EvaluationType = entry.EvaluationType;
    dto.EvaluationValue = entry.EvaluationValue;
    return dto;
  }
}

export class MemberEntryResultEntryDTOV1 {
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

  @ApiPropertyOptional({ type: [RankingEvaluationEntryDTOV1] })
  RankingEvaluationEntries: Array<RankingEvaluationEntryDTOV1>;

  static fromTabT(entry: MemberEntryResultEntry): MemberEntryResultEntryDTOV1 {
    const dto = new MemberEntryResultEntryDTOV1();
    dto.Date = entry.Date;
    dto.UniqueIndex = entry.UniqueIndex;
    dto.FirstName = entry.FirstName;
    dto.LastName = entry.LastName;
    dto.Ranking = entry.Ranking;
    dto.Result = entry.Result;
    dto.SetFor = entry.SetFor;
    dto.SetAgainst = entry.SetAgainst;
    dto.CompetitionType = entry.CompetitionType;
    dto.Club = entry.Club;
    dto.MatchId = entry.MatchId;
    dto.MatchUniqueId = entry.MatchUniqueId;
    dto.TournamentName = entry.TournamentName;
    dto.TournamentSerieName = entry.TournamentSerieName;
    dto.TeamName = entry.TeamName;
    dto.RankingEvaluationCount = entry.RankingEvaluationCount;
    if (entry.RankingEvaluationEntries) {
      dto.RankingEvaluationEntries = entry.RankingEvaluationEntries.map(
        RankingEvaluationEntryDTOV1.fromTabT,
      );
    }
    return dto;
  }
}

export class MemberEntryDTOV1 {
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

  @ApiPropertyOptional({ type: [RankingPointsEntryDTOV1] })
  RankingPointsEntries?: Array<RankingPointsEntryDTOV1>;

  @ApiPropertyOptional()
  Email?: string;

  @ApiPropertyOptional()
  Phone?: PhoneDTOV1;

  @ApiPropertyOptional()
  Address?: AddressDTOV1;

  @ApiPropertyOptional()
  ResultCount?: number;

  @ApiPropertyOptional({ type: [MemberEntryResultEntryDTOV1] })
  ResultEntries?: Array<MemberEntryResultEntryDTOV1>;

  @ApiPropertyOptional()
  NationalNumber?: string;

  static fromTabT(entry: MemberEntry): MemberEntryDTOV1 {
    const dto = new MemberEntryDTOV1();
    dto.Position = entry.Position;
    dto.UniqueIndex = entry.UniqueIndex;
    dto.RankingIndex = entry.RankingIndex;
    dto.FirstName = entry.FirstName;
    dto.LastName = entry.LastName;
    dto.Ranking = entry.Ranking;
    dto.Status = entry.Status;
    dto.Club = entry.Club;
    dto.Gender = entry.Gender;
    dto.Category = entry.Category;
    dto.BirthDate = entry.BirthDate;
    dto.MedicalAttestation = entry.MedicalAttestation;
    dto.RankingPointsCount = entry.RankingPointsCount;
    dto.RankingPointsEntries = entry.RankingPointsEntries
      ? entry.RankingPointsEntries.map(RankingPointsEntryDTOV1.fromTabT)
      : undefined;
    dto.Email = entry.Email;
    dto.Phone = entry.Phone ? PhoneDTOV1.fromTabT(entry.Phone) : undefined;
    dto.Address = entry.Address
      ? AddressDTOV1.fromTabT(entry.Address)
      : undefined;
    dto.ResultCount = entry.ResultCount;
    dto.ResultEntries = entry.ResultEntries
      ? entry.ResultEntries.map(MemberEntryResultEntryDTOV1.fromTabT)
      : undefined;
    dto.NationalNumber = entry.NationalNumber;
    return dto;
  }
}

export class WeeklyNumericPointsV1 {
  @ApiProperty()
  date: string;

  @ApiProperty()
  points: number;

  @ApiProperty()
  ranking: number;

  @ApiPropertyOptional()
  rankingLetterEstimation?: string;
}

export class NumericRankingPerWeekOpponentsV1 {
  @ApiProperty()
  opponentName: string;

  @ApiProperty()
  opponentUniqueIndex: number;

  @ApiProperty()
  opponentRanking: string;

  @ApiProperty()
  opponentNumericPoints: number;

  @ApiProperty()
  pointsWon: number;

  @ApiProperty()
  score: string;
}

export enum COMPETITION_TYPE {
  CHAMPIONSHIP = 'championship',
  TOURNAMENT = 'tournament',
}

export class NumericRankingDetailsV1 {
  @ApiProperty()
  date: string;

  @ApiProperty({
    enum: COMPETITION_TYPE,
  })
  competitionType: COMPETITION_TYPE;

  @ApiProperty()
  competitionContext: string;

  @ApiProperty()
  basePoints: number;

  @ApiProperty()
  endPoints: number;

  @ApiProperty({
    type: [NumericRankingPerWeekOpponentsV1],
  })
  opponents: NumericRankingPerWeekOpponentsV1[];
}

export class GetPlayerCategoriesInputV1 {
  @ApiPropertyOptional()
  uniqueIndex?: string;
  @ApiPropertyOptional()
  shortNameSearch?: string;
  @ApiPropertyOptional()
  rankingCategory?: string;
}
export class PlayerCategoryEntriesDTOV1 {
  @ApiPropertyOptional()
  uniqueIndex?: string;
  @ApiPropertyOptional()
  name?: string;
  @ApiPropertyOptional()
  shortName?: string;
  @ApiPropertyOptional()
  rankingCategory?: string;
  @ApiPropertyOptional()
  isGroup?: string;
  @ApiPropertyOptional()
  groupMembers?: string;
  @ApiPropertyOptional()
  sex?: string;
  @ApiPropertyOptional()
  strictSex?: string;
  @ApiPropertyOptional()
  minimumAge?: string;
  @ApiPropertyOptional()
  maximumAge?: string;
  @ApiPropertyOptional()
  strictMinimumAge?: string;
  @ApiPropertyOptional()
  strictMaximumAge?: string;

  static fromTabT(input: PlayerCategoryEntries): PlayerCategoryEntriesDTOV1 {
    const dto = new PlayerCategoryEntriesDTOV1();
    dto.uniqueIndex = input.UniqueIndex;
    dto.name = input.Name;
    dto.shortName = input.ShortName;
    dto.rankingCategory = input.RankingCategory;
    dto.isGroup = input.IsGroup;
    dto.groupMembers = input.GroupMembers;
    dto.sex = input.Sex;
    dto.strictSex = input.StrictSex;
    dto.minimumAge = input.MinimumAge;
    dto.maximumAge = input.MaximumAge;
    return dto;
  }
}

export class WeeklyNumericPointsInputV1 {
  @ApiProperty({
    enum: PlayerCategoryDTO,
  })
  category: PlayerCategoryDTO;
}
