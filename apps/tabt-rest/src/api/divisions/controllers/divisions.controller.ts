import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import {
  DivisionEntry,
  RankingEntry,
  TeamMatchesEntry,
} from '../../../entity/tabt-soap/TabTAPI_Port';
import { DivisionService } from '../../../services/divisions/division.service';
import {
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiExtraModels,
} from '@nestjs/swagger';
import { TabtException } from '../../../common/filter/tabt-exceptions.filter';
import { DivisionRankingService } from '../../../services/divisions/division-ranking.service';
import { TabtHeadersDecorator } from '../../../common/decorators/tabt-headers.decorator';
import {
  DivisionEntryDtoV1,
  GetDivisionMatchesV1,
  GetDivisionRankingV1,
  GetDivisionsV1,
  RankingEntryDtoV1,
} from '../dto/divisions.dto';
import { MatchService } from '../../../services/matches/match.service';
import {
  MatchesMembersRankerService,
  PlayerMatchStats,
} from '../../../services/matches/matches-members-ranker.service';
import { TeamMatchesEntryDTO } from '../../match/dto/match-model.dto';

@Controller({
  path: 'divisions',
})
@TabtHeadersDecorator()
@ApiTags('Divisions')
@ApiExtraModels(DivisionEntryDtoV1)
export class DivisionsController {
  constructor(
    private divisionService: DivisionService,
    private divisionRankingService: DivisionRankingService,
    private matchesService: MatchService,
    private matchesMembersRankerService: MatchesMembersRankerService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'findAllDivisionsV1',
    summary: 'List of divisions for a specific season with enum string values.',
  })
  @ApiResponse({
    description:
      'List of divisions for a specific season with enum string values.',
    type: [DivisionEntryDtoV1],
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  @Version('1')
  @UseInterceptors(ClassSerializerInterceptor)
  async getDivisionsV1(
    @Query() query: GetDivisionsV1,
  ): Promise<DivisionEntryDtoV1[]> {
    const divisions = await this.divisionService.getDivisionsV1(query);
    return divisions.map(DivisionEntryDtoV1.fromDivisionEntry);
  }

  @Get(':divisionId')
  @ApiOperation({
    operationId: 'findDivisionByIdV1',
  })
  @ApiResponse({
    description: 'A specific division based on the id.',
    type: DivisionEntryDtoV1,
    status: 200,
  })
  @ApiNotFoundResponse({ description: 'The division not found' })
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  @Version('1')
  @UseInterceptors(ClassSerializerInterceptor)
  async findOneV1(
    @Param('divisionId', ParseIntPipe) id: number,
  ): Promise<DivisionEntryDtoV1> {
    const division = await this.divisionService.getDivisionByIdV1(id);
    if (!division) {
      throw new NotFoundException();
    }
    return DivisionEntryDtoV1.fromDivisionEntry(division);
  }

  @Get(':divisionId/ranking')
  @ApiOperation({
    operationId: 'findDivisionRankingV1',
  })
  @ApiResponse({
    description:
      'The ranking for a specific division based on the id of the division.',
    type: [RankingEntryDtoV1],
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  @Version('1')
  async findRankingDivisionV1(
    @Param('divisionId', ParseIntPipe) id: number,
    @Query() query: GetDivisionRankingV1,
  ): Promise<RankingEntryDtoV1[]> {
    const entries = await this.divisionRankingService.getDivisionRanking({
      DivisionId: id,
      RankingSystem: query.rankingSystem,
      WeekName: query.weekName,
    });
    return entries.map(RankingEntryDtoV1.fromTabT);
  }

  @Get(':divisionId/matches')
  @ApiOperation({
    operationId: 'findDivisionMatchesV1',
  })
  @ApiResponse({
    description: 'A list of matches.',
    type: [TeamMatchesEntryDTO],
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  @Version('1')
  async findMatchesDivisionV1(
    @Param('divisionId', ParseIntPipe) id: number,
    @Query() query: GetDivisionMatchesV1,
  ): Promise<TeamMatchesEntryDTO[]> {
    const matches = await this.matchesService.getMatches({
      DivisionId: id,
    });
    return matches.map(TeamMatchesEntryDTO.fromTabT);
  }

  @Get(':divisionId/members/ranking')
  @ApiOperation({
    operationId: 'findDivisionMembersV1',
  })
  @ApiResponse({
    description: 'A ranking of members playing in a given division.',
    type: [PlayerMatchStats],
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  @Version('1')
  async findMembersInDivisionV1(
    @Param('divisionId', ParseIntPipe) id: number,
  ): Promise<PlayerMatchStats[]> {
    return this.matchesMembersRankerService.getMembersRankingFromDivision(id);
  }
}
