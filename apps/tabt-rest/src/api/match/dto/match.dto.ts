import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DivisionCategoryDTO } from '../../../common/dto/division-category.dto';
import { LevelDTO } from '../../../common/dto/levels.dto';

export class GetMatches {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value), { toClassOnly: true })
  divisionId?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  club?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  team?: string;

  @ApiPropertyOptional({
    enum: DivisionCategoryDTO,
  })
  @IsEnum(DivisionCategoryDTO)
  @IsOptional()
  divisionCategory?: DivisionCategoryDTO;

  @ApiPropertyOptional({
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value), { toClassOnly: true })
  weekName?: string;

  @ApiPropertyOptional({
    enum: LevelDTO,
  })
  @IsEnum(LevelDTO)
  @IsOptional()
  level?: LevelDTO;

  @ApiPropertyOptional()
  @IsEnum(['no', 'yes', 'short'])
  @IsOptional()
  showDivisionName?: 'no' | 'yes' | 'short';

  @ApiPropertyOptional({
    description: 'YYYY-MM-DD',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/i)
  yearDateFrom?: string;

  @ApiPropertyOptional({
    description: 'YYYY-MM-DD',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/i)
  yearDateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true, {
    toClassOnly: true,
  })
  withDetails?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  matchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value), { toClassOnly: true })
  matchUniqueId?: number;
}

export class GetMatch extends OmitType(GetMatches, [
  'matchUniqueId',
] as const) {}
