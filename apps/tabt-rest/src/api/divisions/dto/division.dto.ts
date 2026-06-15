import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlayerCategory } from 'apps/tabt-rest/src/entity/tabt-input.interface';

export class TeamEntryDto {
  @ApiProperty()
  TeamId: string;

  @ApiProperty()
  Team: string;

  @ApiProperty()
  DivisionId: number;

  @ApiProperty()
  DivisionName: string;

  @ApiPropertyOptional({
    enum: PlayerCategory,
    enumName: 'PlayerCategory',
    description: 'Division category',
    example: 'MEN',
    type: 'string',
  })
  DivisionCategory?: keyof typeof PlayerCategory;

  @ApiProperty()
  MatchType: number;
}
