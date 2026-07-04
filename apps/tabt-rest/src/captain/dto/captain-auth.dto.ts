import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CaptainLoginDto {
  @ApiProperty({ description: 'AFTT account (never persisted).' })
  @IsString()
  @IsNotEmpty()
  account: string;

  @ApiProperty({
    description: 'AFTT password (never persisted, never logged).',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description:
      'Self-declared member unique index; verified against the AFTT account.',
  })
  @IsInt()
  claimedUniqueIndex: number;
}

export class CaptainRefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class CaptainMemberDto {
  @ApiProperty()
  uniqueIndex: number;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  clubIndex: string;

  @ApiPropertyOptional()
  ranking?: string;

  @ApiPropertyOptional()
  rankingIndex?: number;
}

export class CaptainSessionDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: CaptainMemberDto })
  member: CaptainMemberDto;
}
