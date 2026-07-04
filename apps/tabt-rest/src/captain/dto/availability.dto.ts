import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { AvailabilityStatus, ResponseSource } from '@app/common';

export class AvailabilityPollDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  matchUniqueId: number;

  @ApiProperty()
  teamId: string;

  @ApiProperty()
  clubIndex: string;

  @ApiProperty()
  createdAt: string;
}

export class AvailabilityEntryDto {
  @ApiProperty()
  uniqueIndex: number;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  ranking: string;

  @ApiProperty()
  rankingIndex: number;

  @ApiProperty({ enum: AvailabilityStatus })
  status: AvailabilityStatus;

  @ApiPropertyOptional()
  note?: string;

  @ApiPropertyOptional()
  respondedAt?: string;

  @ApiProperty({ enum: ResponseSource })
  source: ResponseSource;
}

export class MatchAvailabilityDto {
  @ApiProperty({ type: AvailabilityPollDto })
  poll: AvailabilityPollDto;

  @ApiProperty({ type: [AvailabilityEntryDto] })
  responses: AvailabilityEntryDto[];
}

export class CreateAvailabilityPollDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  teamId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clubIndex: string;

  @ApiProperty({
    type: [Number],
    description: 'Roster of member unique indexes.',
  })
  @IsArray()
  @IsInt({ each: true })
  rosterUniqueIndexes: number[];
}

export class SubmitAvailabilityDto {
  @ApiProperty()
  @IsInt()
  uniqueIndex: number;

  @ApiProperty({ enum: AvailabilityStatus })
  @IsEnum(AvailabilityStatus)
  status: AvailabilityStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({
    description: 'Signed token from the push/link, scoping the response.',
  })
  @IsString()
  @IsOptional()
  responseToken?: string;
}

export class OverrideAvailabilityDto {
  @ApiProperty({ enum: AvailabilityStatus })
  @IsEnum(AvailabilityStatus)
  status: AvailabilityStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}

export class AvailabilityResponseDto extends AvailabilityEntryDto {}

export class RemindAvailabilityResultDto {
  @ApiProperty()
  remindedCount: number;
}

export class PlayerAvailabilityPollDto {
  @ApiProperty()
  matchUniqueId: number;

  @ApiProperty()
  teamId: string;

  @ApiProperty({ enum: AvailabilityStatus })
  status: AvailabilityStatus;

  @ApiPropertyOptional()
  note?: string;
}

export class PlayerAvailabilityDto {
  @ApiProperty()
  uniqueIndex: number;

  @ApiProperty({ type: [PlayerAvailabilityPollDto] })
  polls: PlayerAvailabilityPollDto[];
}
