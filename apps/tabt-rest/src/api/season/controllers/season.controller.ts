import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { SeasonService } from '../../../services/seasons/season.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TabtExceptionResponse } from '../../../common/filter/tabt-exception-response.dto';
import { SeasonDto } from '../dto/season.dto';

@Controller({
  path: 'seasons',
  version: '1',
})
@ApiTags('Seasons')
export class SeasonController {
  constructor(private seasonService: SeasonService) {}

  @Get()
  @ApiOperation({
    operationId: 'findAllSeason',
  })
  @ApiResponse({
    description: 'A list of seasons.',
    type: [SeasonDto],
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtExceptionResponse,
  })
  findAll() {
    return this.seasonService
      .getSeasons()
      .then((seasons) => seasons.map(SeasonDto.fromTabT));
  }

  @Get('current')
  @ApiOperation({
    operationId: 'findCurrentSeason',
  })
  @ApiResponse({
    description: 'The current season.',
    type: SeasonDto,
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtExceptionResponse,
  })
  findCurrentSeason() {
    return this.seasonService.getCurrentSeason().then(SeasonDto.fromTabT);
  }

  @Get('/:seasonId')
  @ApiOperation({
    operationId: 'findSeasonById',
  })
  @ApiResponse({
    description: 'Get a specific season',
    type: SeasonDto,
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtExceptionResponse,
  })
  findById(@Param('seasonId', ParseIntPipe) seasonId: number) {
    return this.seasonService.getSeasonById(seasonId).then(SeasonDto.fromTabT);
  }
}
