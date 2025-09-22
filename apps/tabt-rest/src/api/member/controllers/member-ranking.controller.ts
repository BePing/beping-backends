import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  RankingDistributionDTOV1,
  WeeklyNumericRankingInputV2,
} from '../../dashboard/dto/member-dashboard.dto';
import { RankingDistributionService } from '../../../services/members/ranking-distribution.service';

@ApiTags('Members')
@Controller({
  path: 'members/rankings',
  version: '1',
})
export class MemberRankingController {
  constructor(
    private readonly rankingDistributionService: RankingDistributionService,
  ) {}
}
