import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeamEntry } from '../../../entity/tabt-soap/TabTAPI_Port';
import { Transform } from 'class-transformer';
import {
  DivisionCategoryDTO,
  mapDivisionCategoryToDivisionCategoryDTO,
} from '../../../common/dto/division-category.dto';

export class TeamDto {
  @ApiProperty()
  teamId: string;

  @ApiProperty()
  team: string;

  @ApiProperty()
  divisionId: number;

  @ApiProperty()
  divisionName: string;

  @ApiPropertyOptional({ enum: DivisionCategoryDTO })
  @Transform((cat) => mapDivisionCategoryToDivisionCategoryDTO(cat.value), {
    toPlainOnly: true,
  })
  divisionCategory?: DivisionCategoryDTO;

  @ApiProperty()
  matchType: number;

  static fromTabT(team: TeamEntry): TeamDto {
    const dto = new TeamDto();
    dto.teamId = team.TeamId;
    dto.team = team.Team;
    dto.divisionId = team.DivisionId;
    dto.divisionName = team.DivisionName;
    dto.divisionCategory = mapDivisionCategoryToDivisionCategoryDTO(
      team.DivisionCategory,
    );
    dto.matchType = team.MatchType;
    return dto;
  }
}
