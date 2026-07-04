import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LineupStatus, SlotRole } from '@app/common';
import { AvailabilityEntryDto } from './availability.dto';
import { RuleCode, RuleLevel } from '../lineup/rules/rule.types';

export class LineupSlotInputDto {
  @ApiProperty()
  @IsInt()
  uniqueIndex: number;

  @ApiProperty({ description: '1..4 starters, >100 bench.' })
  @IsInt()
  orderPos: number;

  @ApiProperty({ enum: SlotRole })
  @IsEnum(SlotRole)
  role: SlotRole;
}

export class SaveLineupDto {
  @ApiProperty({ type: [LineupSlotInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineupSlotInputDto)
  slots: LineupSlotInputDto[];
}

export class ValidateLineupDto {
  @ApiPropertyOptional({ description: 'Override blocking warnings.' })
  @IsBoolean()
  @IsOptional()
  overrideWarnings?: boolean;

  @ApiPropertyOptional({ description: 'Required when overriding warnings.' })
  @IsString()
  @IsOptional()
  justification?: string;
}

export class LineupSlotDto {
  @ApiProperty()
  uniqueIndex: number;

  @ApiProperty()
  orderPos: number;

  @ApiProperty({ enum: SlotRole })
  role: SlotRole;

  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiPropertyOptional()
  ranking?: string;

  @ApiPropertyOptional()
  rankingIndex?: number;
}

export class RuleViolationDto {
  @ApiProperty({ enum: RuleCode })
  code: RuleCode;

  @ApiProperty({ enum: RuleLevel })
  level: RuleLevel;

  @ApiProperty()
  messageKey: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  params: Record<string, string>;
}

export class LineupValidationDto {
  @ApiProperty({ enum: LineupStatus })
  status: LineupStatus;

  @ApiProperty({ type: [RuleViolationDto] })
  errors: RuleViolationDto[];

  @ApiProperty({ type: [RuleViolationDto] })
  warnings: RuleViolationDto[];

  @ApiProperty()
  canOverride: boolean;

  @ApiPropertyOptional()
  provinceUnsupported?: boolean;
}

export class OpponentLineupEntryDto {
  @ApiProperty()
  position: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  ranking: string;
}

export class LineupDto {
  @ApiProperty()
  matchUniqueId: number;

  @ApiProperty({ enum: LineupStatus })
  status: LineupStatus;

  @ApiProperty({ type: [LineupSlotDto] })
  slots: LineupSlotDto[];

  @ApiProperty({ type: [AvailabilityEntryDto] })
  roster: AvailabilityEntryDto[];

  @ApiPropertyOptional({ type: LineupValidationDto })
  validation?: LineupValidationDto;

  @ApiPropertyOptional({ type: [OpponentLineupEntryDto] })
  opponentLastLineup?: OpponentLineupEntryDto[];
}
