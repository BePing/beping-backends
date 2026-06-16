import { IsNumber, IsString, IsEnum } from 'class-validator';
import { PlayerCategory } from '@app/common';

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
