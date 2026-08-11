import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Version,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChallengeService } from './challenge.service';
import {
  ChallengePlayerRankingDto,
  ChallengePlayerRankingsResponseDto,
  ChallengePublicationDto,
  ChallengeRankingPageDto,
  ChallengeRankingsQueryDto,
  ChallengeRegionSummaryDto,
  ChallengeSeasonQueryDto,
  ChallengeSummaryDto,
} from './dto/challenge.dto';

@ApiTags('Challenges')
@Controller({ path: 'challenges', version: '1' })
export class ChallengeController {
  constructor(private readonly challenges: ChallengeService) {}

  @Get()
  @Version('1')
  @ApiOperation({ operationId: 'listChallenges' })
  @ApiOkResponse({ type: ChallengeSummaryDto, isArray: true })
  list(): Promise<ChallengeSummaryDto[]> {
    return this.challenges.listActiveChallenges();
  }

  @Get(':slug/publications/latest')
  @Version('1')
  @ApiOperation({ operationId: 'getLatestChallengePublication' })
  @ApiOkResponse({ type: ChallengePublicationDto })
  latestPublication(
    @Param('slug') slug: string,
    @Query() query: ChallengeSeasonQueryDto,
  ): Promise<ChallengePublicationDto | undefined> {
    return this.challenges.getLatestPublication(slug, query);
  }

  @Get(':slug/rankings')
  @Version('1')
  @ApiOperation({ operationId: 'getChallengeRankings' })
  @ApiOkResponse({ type: ChallengeRankingPageDto })
  rankings(
    @Param('slug') slug: string,
    @Query() query: ChallengeRankingsQueryDto,
  ): Promise<ChallengeRankingPageDto> {
    return this.challenges.getRankings(slug, query);
  }

  @Get(':slug/players/:uniqueIndex')
  @Version('1')
  @ApiOperation({ operationId: 'getChallengePlayer' })
  @ApiOkResponse({ type: ChallengePlayerRankingsResponseDto })
  player(
    @Param('slug') slug: string,
    @Param('uniqueIndex', ParseIntPipe) uniqueIndex: number,
    @Query() query: ChallengeSeasonQueryDto,
  ): Promise<ChallengePlayerRankingsResponseDto> {
    return this.challenges.getChallengePlayerRankings(slug, uniqueIndex, query);
  }

  @Get(':slug/regions/:region/summary')
  @Version('1')
  @ApiOperation({ operationId: 'getChallengeRegionSummary' })
  @ApiOkResponse({ type: ChallengeRegionSummaryDto })
  regionSummary(
    @Param('slug') slug: string,
    @Param('region') region: string,
    @Query() query: ChallengeSeasonQueryDto,
  ): Promise<ChallengeRegionSummaryDto | undefined> {
    return this.challenges.getRegionSummary(slug, region, query);
  }
}

@ApiTags('Members')
@Controller({ path: 'members', version: '1' })
export class MemberChallengeRankingsController {
  constructor(private readonly challenges: ChallengeService) {}

  @Get(':uniqueIndex/challenge-rankings')
  @Version('1')
  @ApiOperation({ operationId: 'getMemberChallengeRankings' })
  @ApiOkResponse({ type: ChallengePlayerRankingDto, isArray: true })
  rankings(
    @Param('uniqueIndex', ParseIntPipe) uniqueIndex: number,
  ): Promise<ChallengePlayerRankingDto[]> {
    return this.challenges.getMemberChallengeRankings(uniqueIndex);
  }
}
