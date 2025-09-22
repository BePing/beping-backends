import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TournamentSerieEntry } from '../../../entity/tabt-soap/TabTAPI_Port';
import { TabtException } from '../../../common/filter/tabt-exceptions.filter';
import { TournamentService } from '../../../services/tournaments/tournament.service';
import {
  GetTournamentDetails,
  RegisterTournament,
} from '../dto/tournaments.dto';
import { TabtHeadersDecorator } from '../../../common/decorators/tabt-headers.decorator';
import {
  TournamentEntryDTOV1,
  TournamentSerieEntryDTOV1,
} from '../dto/tournament.dto';

@ApiTags('Tournaments')
@Controller({
  path: 'tournaments',
  version: '1',
})
@TabtHeadersDecorator()
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  @Get()
  @ApiOperation({
    operationId: 'findAllTournamentsV1',
  })
  @ApiResponse({
    description: 'A list of tournament.',
    type: [TournamentEntryDTOV1],
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  @Version('1')
  @UseInterceptors(ClassSerializerInterceptor)
  async findAllV1() {
    const tournaments = await this.tournamentService.getTournaments({});
    return tournaments.map(TournamentEntryDTOV1.fromTabT);
  }

  @Get(':tournamentId')
  @ApiOperation({
    operationId: 'findTournamentByIdV1',
  })
  @ApiResponse({
    description: 'A specific tournament.',
    type: TournamentEntryDTOV1,
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  @UseInterceptors(ClassSerializerInterceptor)
  @Version('1')
  async findByIdV1(
    @Query() input: GetTournamentDetails,
    @Param('tournamentId', ParseIntPipe) id: number,
  ) {
    const result = await this.tournamentService.getTournaments({
      WithRegistrations: input.withRegistrations,
      WithResults: input.withResults,
      TournamentUniqueIndex: id,
    });
    if (result.length) {
      return TournamentEntryDTOV1.fromTabT(result[0]);
    }
    throw new NotFoundException();
  }

  @Get(':tournamentId/series')
  @ApiOperation({
    operationId: 'findSeriesByTournamentV1',
  })
  @ApiResponse({
    description: 'A specific tournament.',
    type: [TournamentSerieEntryDTOV1],
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  @Version('1')
  async getSeriesV1(@Param('tournamentId', ParseIntPipe) id: number) {
    const result = await this.tournamentService.getTournaments({
      TournamentUniqueIndex: id,
      WithRegistrations: true,
    });
    if (result.length) {
      return result[0].SerieEntries.map(TournamentSerieEntryDTOV1.fromTabT);
    }
    throw new NotFoundException();
  }

  @Post(':tournamentId/serie/:serieId/register')
  @ApiOperation({
    operationId: 'registerToSerieV1',
  })
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  @Version('1')
  async registerV1(
    @Body() input: RegisterTournament,
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('serieId', ParseIntPipe) serieId: number,
  ) {
    return this.tournamentService.registerToTournament({
      TournamentUniqueIndex: tournamentId,
      SerieUniqueIndex: serieId,
      PlayerUniqueIndex: input.playerUniqueIndex,
      NotifyPlayer: input.notifyPlayer,
      Unregister: input.unregister,
    });
  }
}
