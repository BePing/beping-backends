import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CaptainLineupService } from './captain-lineup.service';
import { CaptainIntelligenceService } from '../intelligence/captain-intelligence.service';
import { CaptainJwtGuard, CaptainPrincipal } from '../auth/captain-jwt.guard';
import { CaptainProGuard } from '../auth/captain-pro.guard';
import { CaptainUser } from '../auth/captain-user.decorator';
import {
  LineupDto,
  LineupValidationDto,
  SaveLineupDto,
  ValidateLineupDto,
} from '../dto/lineup.dto';
import { LineupIntelligenceDto } from '../dto/intelligence.dto';

@ApiTags('Captain')
@Controller({ path: 'captain', version: '1' })
export class CaptainLineupController {
  constructor(
    private readonly lineupService: CaptainLineupService,
    private readonly intelligenceService: CaptainIntelligenceService,
  ) {}

  @Get('matches/:matchUniqueId/lineup')
  @UseGuards(CaptainJwtGuard)
  @ApiOperation({ operationId: 'getLineup' })
  @ApiOkResponse({ type: LineupDto })
  getLineup(
    @Param('matchUniqueId', ParseIntPipe) matchUniqueId: number,
    @CaptainUser() captain: CaptainPrincipal,
  ): Promise<LineupDto> {
    return this.lineupService.getLineup(matchUniqueId, captain);
  }

  @Put('matches/:matchUniqueId/lineup')
  @UseGuards(CaptainJwtGuard)
  @ApiOperation({ operationId: 'saveLineup' })
  @ApiOkResponse({ type: LineupDto })
  saveLineup(
    @Param('matchUniqueId', ParseIntPipe) matchUniqueId: number,
    @CaptainUser() captain: CaptainPrincipal,
    @Body() dto: SaveLineupDto,
  ): Promise<LineupDto> {
    return this.lineupService.saveLineup(matchUniqueId, captain, dto);
  }

  @Post('matches/:matchUniqueId/lineup/validate')
  @UseGuards(CaptainJwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'validateLineup' })
  @ApiOkResponse({ type: LineupValidationDto })
  validateLineup(
    @Param('matchUniqueId', ParseIntPipe) matchUniqueId: number,
    @CaptainUser() captain: CaptainPrincipal,
    @Body() dto: ValidateLineupDto,
  ): Promise<LineupValidationDto> {
    return this.lineupService.validateLineup(matchUniqueId, captain, dto);
  }

  @Get('matches/:matchUniqueId/lineup/intelligence')
  @UseGuards(CaptainJwtGuard, CaptainProGuard)
  @ApiOperation({ operationId: 'getLineupIntelligence' })
  @ApiOkResponse({ type: LineupIntelligenceDto })
  getLineupIntelligence(
    @Param('matchUniqueId', ParseIntPipe) matchUniqueId: number,
    @CaptainUser() captain: CaptainPrincipal,
  ): Promise<LineupIntelligenceDto> {
    return this.intelligenceService.getIntelligence(matchUniqueId, captain);
  }
}
