import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { LevelDTO, mapLevelToLevelDTO } from '../../../common/dto/levels.dto';
import {
  mapPlayerCategoryToPlayerCategoryDTO,
  PlayerCategoryDTO,
} from '../../../common/dto/player-category.dto';
import {
  DivisionCategoryDTO,
  mapDivisionCategoryToDivisionCategoryDTO,
} from '../../../common/dto/division-category.dto';
import {
  DivisionEntry,
  RankingEntry,
} from '../../../entity/tabt-soap/TabTAPI_Port';

// Base DTO with common properties
export class GetDivisionsV1 {
  @ApiPropertyOptional({
    enum: ['no', 'yes', 'short'],
    description: 'How to show division names',
  })
  @IsOptional()
  @IsEnum(['no', 'yes', 'short'])
  showDivisionName?: 'no' | 'yes' | 'short';

  @ApiPropertyOptional({
    enum: LevelDTO,
    description: 'Filter divisions by level category',
    example: 'NATIONAL',
  })
  @IsOptional()
  @IsEnum(LevelDTO)
  level?: keyof typeof LevelDTO;

  @ApiPropertyOptional({
    enum: DivisionCategoryDTO,
    description: 'Filter divisions by division category',
  })
  @IsOptional()
  @IsEnum(DivisionCategoryDTO)
  divisionCategory?: DivisionCategoryDTO;
}

export class DivisionEntryDtoV1 {
  @ApiProperty()
  DivisionId: number;

  @ApiPropertyOptional()
  DivisionName: string;

  @ApiProperty({ enum: LevelDTO })
  Level: LevelDTO;

  @ApiProperty()
  MatchType: number;

  @ApiPropertyOptional({ enum: DivisionCategoryDTO })
  DivisionCategory?: DivisionCategoryDTO;

  @ApiPropertyOptional({ enum: PlayerCategoryDTO })
  PlayerCategory?: PlayerCategoryDTO;

  // factory method
  static fromDivisionEntry(divisionEntry: DivisionEntry): DivisionEntryDtoV1 {
    return {
      ...divisionEntry,
      DivisionCategory: mapDivisionCategoryToDivisionCategoryDTO(
        divisionEntry.DivisionCategory,
      ),
      Level: mapLevelToLevelDTO(divisionEntry.Level),
      PlayerCategory: mapPlayerCategoryToPlayerCategoryDTO(
        divisionEntry.PlayerCategory,
      ),
    };
  }
}

export class GetDivisionMatchesV1 {
  @ApiPropertyOptional()
  weekName: string;

  @ApiPropertyOptional()
  yearDateFrom: string;

  @ApiPropertyOptional()
  yearDateTo: string;

  @ApiPropertyOptional()
  withDetails: boolean;
}

export class GetDivisionRankingV1 {
  @ApiPropertyOptional()
  rankingSystem?: number;

  @ApiPropertyOptional()
  weekName?: string;
}

export class RankingEntryDtoV1 {
  @ApiProperty()
  position: number;

  @ApiProperty()
  team: string;

  @ApiProperty()
  gamesPlayed: number;

  @ApiProperty()
  gamesWon: number;

  @ApiProperty()
  gamesLost: number;

  @ApiProperty()
  gamesDraw: number;

  @ApiProperty()
  gamesWO: number;

  @ApiProperty()
  individualMatchesWon: number;

  @ApiProperty()
  individualMatchesLost: number;

  @ApiProperty()
  individualSetsWon: number;

  @ApiProperty()
  individualSetsLost: number;

  @ApiProperty()
  points: number;

  @ApiProperty()
  teamClub: string;

  static fromTabT(entry: RankingEntry): RankingEntryDtoV1 {
    const dto = new RankingEntryDtoV1();
    dto.position = entry.Position;
    dto.team = entry.Team;
    dto.gamesPlayed = entry.GamesPlayed;
    dto.gamesWon = entry.GamesWon;
    dto.gamesLost = entry.GamesLost;
    dto.gamesDraw = entry.GamesDraw;
    dto.gamesWO = entry.GamesWO;
    dto.individualMatchesWon = entry.IndividualMatchesWon;
    dto.individualMatchesLost = entry.IndividualMatchesLost;
    dto.individualSetsWon = entry.IndividualSetsWon;
    dto.individualSetsLost = entry.IndividualSetsLost;
    dto.points = entry.Points;
    dto.teamClub = entry.TeamClub;
    return dto;
  }
}
