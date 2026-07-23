import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ConvocationStatus } from '@app/common';

export class SendConvocationDto {
  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  meetingTime?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  venue?: string;
}

export class ConvocationResponseEntryDto {
  @ApiProperty()
  uniqueIndex: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ConvocationStatus })
  status: ConvocationStatus;

  @ApiPropertyOptional()
  respondedAt?: string;
}

export class ConvocationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  matchUniqueId: number;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  meetingTime?: string;

  @ApiPropertyOptional()
  venue?: string;

  @ApiPropertyOptional()
  publicLink?: string;

  @ApiProperty()
  sentAt: string;

  @ApiProperty({ type: [ConvocationResponseEntryDto] })
  responses: ConvocationResponseEntryDto[];
}

export class RespondConvocationDto {
  @ApiProperty()
  @IsInt()
  uniqueIndex: number;

  @ApiProperty({ enum: ConvocationStatus })
  @IsEnum(ConvocationStatus)
  status: ConvocationStatus;

  @ApiProperty()
  @IsString()
  responseToken: string;
}

export class ConvocationResponseDto extends ConvocationResponseEntryDto {}

export class PublicRespondConvocationDto {
  @ApiProperty()
  @IsInt()
  uniqueIndex: number;

  @ApiProperty({ enum: ConvocationStatus })
  @IsEnum(ConvocationStatus)
  status: ConvocationStatus;

  @ApiProperty()
  @IsString()
  responseToken: string;
}

export class PublicConvocationDto {
  @ApiProperty()
  matchUniqueId: number;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  meetingTime?: string;

  @ApiPropertyOptional()
  venue?: string;

  @ApiProperty()
  opponent: string;

  @ApiProperty()
  date: string;

  @ApiProperty()
  time: string;

  @ApiProperty({ type: [ConvocationResponseEntryDto] })
  responses: ConvocationResponseEntryDto[];
}
