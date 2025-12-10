import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RankingTableDTOV1 } from '../../dashboard/dto/member-dashboard.dto';
import { RankingDistributionService } from '../../../services/members/ranking-distribution.service';
import { PlayerCategoryDTO } from '../../../common/dto/player-category.dto';

@ApiTags('Members')
@Controller({
  path: 'members/rankings',
  version: '1',
})
export class MemberRankingController {
  constructor(
    private readonly rankingDistributionService: RankingDistributionService,
  ) {}

  @Get('table')
  @ApiOkResponse({
    type: RankingTableDTOV1,
    description: 'Returns the current ranking table used for estimation',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: PlayerCategoryDTO,
    description: 'Player category (defaults to SENIOR_MEN)',
  })
  async getRankingTable(
    @Query('category') category: PlayerCategoryDTO = PlayerCategoryDTO.SENIOR_MEN,
  ): Promise<RankingTableDTOV1> {
    const totalPlayers =
      await this.rankingDistributionService.getMembersWithRankingCount(
        category,
      );
    const thresholds =
      this.rankingDistributionService.getRankingTable(totalPlayers, category);

    return {
      totalPlayers,
      category,
      thresholds,
    };
  }
}
