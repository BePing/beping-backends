import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChallengeSummaryDto {
  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  shortName?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  unofficial: boolean;

  @ApiProperty()
  unofficialLabel: string;

  @ApiProperty()
  displayOrder: number;

  @ApiPropertyOptional()
  activeSeason?: number;

  @ApiPropertyOptional()
  nextPublicationAt?: Date;

  @ApiProperty({ type: () => ChallengeOptionDto, isArray: true })
  regions: ChallengeOptionDto[];

  @ApiProperty({ type: () => ChallengeOptionDto, isArray: true })
  levels: ChallengeOptionDto[];

  @ApiProperty({
    type: String,
    isArray: true,
    description: 'Codes des clubs éligibles aux réglages de ce challenge',
  })
  clubs: string[];
}

export class ChallengeOptionDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  label: string;
}

export class ChallengePublicationDto {
  @ApiProperty()
  challengeSlug: string;

  @ApiProperty()
  challengeName: string;

  @ApiProperty()
  season: number;

  @ApiProperty()
  week: number;

  @ApiProperty()
  publishedAt: Date;

  @ApiProperty()
  checksum: string;

  @ApiProperty()
  totalPlayers: number;
}

export class ChallengePointsBreakdownDto {
  @ApiProperty()
  count5Pts: number;

  @ApiProperty()
  count3Pts: number;

  @ApiProperty()
  count2Pts: number;

  @ApiProperty()
  count1Pts: number;

  @ApiProperty()
  count0Pts: number;
}

export class ChallengePlayerRankingDto {
  @ApiProperty()
  challengeSlug: string;

  @ApiProperty()
  challengeName: string;

  @ApiProperty()
  unofficial: boolean;

  @ApiProperty()
  unofficialLabel: string;

  @ApiProperty()
  season: number;

  @ApiProperty()
  week: number;

  @ApiProperty()
  playerUniqueIndex: number;

  @ApiProperty()
  playerName: string;

  @ApiProperty()
  clubIndex: string;

  @ApiProperty()
  clubName: string;

  @ApiProperty()
  regionCode: string;

  @ApiProperty()
  regionLabel: string;

  @ApiProperty()
  levelCode: string;

  @ApiProperty()
  levelLabel: string;

  @ApiProperty()
  position: number;

  @ApiProperty()
  totalParticipants: number;

  @ApiProperty()
  points: number;

  @ApiProperty({ type: ChallengePointsBreakdownDto })
  breakdown: ChallengePointsBreakdownDto;

  @ApiProperty()
  publishedAt: Date;
}

export class ChallengePlayerRankingsResponseDto {
  @ApiProperty()
  hasRanking: boolean;

  @ApiProperty({ type: ChallengePlayerRankingDto, isArray: true })
  rankings: ChallengePlayerRankingDto[];

  @ApiProperty({ type: () => ChallengePlayerPointDto, isArray: true })
  points: ChallengePlayerPointDto[];
}

export class ChallengePlayerPointDto {
  @ApiProperty()
  matchUniqueId: number;

  @ApiProperty()
  matchId: string;

  @ApiProperty()
  divisionId: number;

  @ApiProperty()
  week: number;

  @ApiProperty()
  levelCode: string;

  @ApiProperty()
  victoryCount: number;

  @ApiProperty()
  forfeit: number;

  @ApiProperty()
  pointsWon: number;
}

export class ChallengeRankingPageDto {
  @ApiPropertyOptional({ type: ChallengePublicationDto })
  publication?: ChallengePublicationDto;

  @ApiProperty({ type: ChallengePlayerRankingDto, isArray: true })
  items: ChallengePlayerRankingDto[];

  @ApiPropertyOptional()
  nextCursor?: string;
}

export class ChallengeRegionSummaryDto {
  @ApiProperty()
  challengeSlug: string;

  @ApiProperty()
  challengeName: string;

  @ApiProperty()
  season: number;

  @ApiProperty()
  week: number;

  @ApiProperty()
  regionCode: string;

  @ApiProperty()
  regionLabel: string;

  @ApiProperty()
  totalPlayers: number;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  playersByLevel: Record<string, number>;

  @ApiProperty({ type: String, isArray: true })
  clubs: string[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  aiSummary?: Record<string, unknown>;

  @ApiProperty()
  publishedAt: Date;
}

export class ChallengeSeasonQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  season?: number;
}

export class ChallengeRankingsQueryDto extends ChallengeSeasonQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  week?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
}
