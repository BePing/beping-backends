import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  MatchSystemEntry,
} from '../../../entity/tabt-soap/TabTAPI_Port';
import { MatchService } from '../../../services/matches/match.service';
import { TabtHeadersDecorator } from '../../../common/decorators/tabt-headers.decorator';
import { MatchSystemService } from '../../../services/matches/match-system.service';
import { GetMatch, GetMatches } from '../dto/match.dto';
import { TeamMatchesEntryDTO } from '../dto/match-model.dto';
import { mapDivisionCategoryDTOToDivisionCategory } from '../../../common/dto/division-category.dto';
import { mapLevelDTOToLevels } from '../../../common/dto/levels.dto';
import { WeeklyPerformanceMetricsDTO } from '../dto/performance-metrics.dto';

@ApiTags('Matches')
@Controller({
  path: 'matches',
  version: '1',
})
@TabtHeadersDecorator()
@UseInterceptors(ClassSerializerInterceptor)
export class MatchController {
  constructor(
    private matchService: MatchService,
    private matchSystemService: MatchSystemService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'findAllMatches',
  })
  @ApiOkResponse({
    type: [TeamMatchesEntryDTO],
    description: 'List of team matches entries',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll( @Query() input: GetMatches): Promise<TeamMatchesEntryDTO[]> {
    const matches = await this.matchService.getMatches({
      DivisionId: input.divisionId,
      Club: input.club,
      Team: input.team,
      DivisionCategory: input.divisionCategory ? mapDivisionCategoryDTOToDivisionCategory(input.divisionCategory) : undefined,
      WeekName: input.weekName,
      Level: input.level ? mapLevelDTOToLevels(input.level)[0] : undefined,
      ShowDivisionName: input.showDivisionName,
      YearDateTo: input.yearDateTo,
      YearDateFrom: input.yearDateFrom,
      WithDetails: input.withDetails,
      MatchId: input.matchId,
      MatchUniqueId: input.matchUniqueId,
    });
    return matches.map(TeamMatchesEntryDTO.fromTabT);
  }

  @Get('systems')
  @ApiOperation({
    operationId: 'findAllMatchSystems',
  })
  @ApiOkResponse({
    type: [MatchSystemEntry],
    description: 'The list of match system',
  })
  async findMatchSystem(): Promise<MatchSystemEntry[]> {
    return this.matchSystemService.getMatchSystems();
  }

  @Get('systems/:matchSystemId')
  @ApiOperation({
    operationId: 'findMatchSystemById',
  })
  @ApiOkResponse({
    type: MatchSystemEntry,
    description: 'A specific match system',
  })
  @ApiNotFoundResponse()
  async findMatchSystemById(
    @Param('matchSystemId', ParseIntPipe) id: number,
  ): Promise<MatchSystemEntry> {
    const matchSystem = await this.matchSystemService.getMatchSystemsById(id);
    if (matchSystem) {
      return matchSystem;
    }
    throw new NotFoundException();
  }

  @Get(':matchUniqueId')
  @ApiOperation({
    operationId: 'findMatchById',
  })
  @ApiOkResponse({
    type: TeamMatchesEntryDTO,
    description: 'The information of a specific match',
  })
  @ApiNotFoundResponse()
  async findById(
    @Query() input: GetMatch,
    @Param('matchUniqueId', ParseIntPipe) id: number,
  ): Promise<TeamMatchesEntryDTO> {
    const found = await this.matchService.getMatches({
      DivisionId: input.divisionId,
      Club: input.club,
      Team: input.team,
      DivisionCategory: input.divisionCategory ? mapDivisionCategoryDTOToDivisionCategory(input.divisionCategory) : undefined,
      WeekName: input.weekName,
      Level: input.level ? mapLevelDTOToLevels(input.level)[0] : undefined,
      ShowDivisionName: input.showDivisionName,
      YearDateTo: input.yearDateTo,
      YearDateFrom: input.yearDateFrom,
      WithDetails: input.withDetails,
      MatchId: input.matchId,
      MatchUniqueId: id,
    });

    if (found.length) {
      return TeamMatchesEntryDTO.fromTabT(found[0]);
    }
    throw new NotFoundException();
  }

  @Get('player/:playerUniqueIndex/performance')
  @ApiOperation({
    operationId: 'getWeeklyPerformanceMetrics',
    description: 'Get weekly performance metrics for a player including load score, fatigue resistance, and recovery score',
  })
  @ApiOkResponse({
    type: WeeklyPerformanceMetricsDTO,
    description: 'Weekly performance metrics for the player',
  })
  @ApiNotFoundResponse()
  async getWeeklyPerformanceMetrics(
    @Param('playerUniqueIndex', ParseIntPipe) playerUniqueIndex: number,
    @Query('weekName') weekName: string,
  ): Promise<WeeklyPerformanceMetricsDTO> {
    return this.matchService.getWeeklyPerformanceMetrics(playerUniqueIndex, weekName);
  }
}
