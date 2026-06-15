import { IsNumber, IsString, IsEnum } from 'class-validator';
import { PlayerCategory } from '@prisma/client';

export class RankingEstimationChangeEventDto {
  @IsNumber()
  uniqueIndex: number;

  @IsString()
  oldRankingEstimation: string;

  @IsString()
  newRankingEstimation: string;

  @IsEnum(PlayerCategory)
  playerCategory: PlayerCategory;
}
