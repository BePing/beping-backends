import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  Version,
} from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  MultiCategoryMemberDashboardDTOV1,
  WeeklyNumericRankingInputV2,
} from '../dto/member-dashboard.dto';
import { MemberDashboardService } from '../services/member-dashboard.service';

@ApiTags('Dashboards')
@Controller({
  path: 'dashboard/member',
  version: '1',
})
export class MemberDashboardController {
  constructor(
    private readonly memberDashboardService: MemberDashboardService,
  ) {}

  @Get(':uniqueIndex')
  @ApiOkResponse({
    type: MultiCategoryMemberDashboardDTOV1,
    description: 'The dashboard information for all categories where the member exists',
  })
  @ApiNotFoundResponse({
    description: 'No info found for given player',
  })
  @ApiQuery({
    name: 'teamId',
    required: false,
    description: 'Team ID to get next match estimation points',
  })
  @Version('1')
  async memberDashboardV1(
    @Param('uniqueIndex', ParseIntPipe) id: number,
    @Query() params: WeeklyNumericRankingInputV2,
  ): Promise<MultiCategoryMemberDashboardDTOV1> {
    const memberDashboard = await this.memberDashboardService.getMultiCategoryDashboard(
      id,
      params.teamId,
    );

    if (memberDashboard.availableCategories.length === 0) {
      throw new NotFoundException(`No member found for id ${id}`);
    }

    return memberDashboard;
  }

}
