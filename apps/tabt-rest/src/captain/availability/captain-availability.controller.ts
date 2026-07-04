import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CaptainAvailabilityService } from './captain-availability.service';
import { CaptainJwtGuard } from '../auth/captain-jwt.guard';
import { CaptainUser } from '../auth/captain-user.decorator';
import { CaptainPrincipal } from '../auth/captain-jwt.guard';
import {
  AvailabilityPollDto,
  AvailabilityResponseDto,
  CreateAvailabilityPollDto,
  MatchAvailabilityDto,
  OverrideAvailabilityDto,
  PlayerAvailabilityDto,
  RemindAvailabilityResultDto,
  SubmitAvailabilityDto,
} from '../dto/availability.dto';

@ApiTags('Captain')
@Controller({ path: 'captain', version: '1' })
export class CaptainAvailabilityController {
  constructor(private readonly service: CaptainAvailabilityService) {}

  @Post('matches/:matchUniqueId/availability-poll')
  @UseGuards(CaptainJwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ operationId: 'createAvailabilityPoll' })
  @ApiOkResponse({ type: AvailabilityPollDto })
  createPoll(
    @Param('matchUniqueId', ParseIntPipe) matchUniqueId: number,
    @CaptainUser() captain: CaptainPrincipal,
    @Body() dto: CreateAvailabilityPollDto,
  ): Promise<AvailabilityPollDto> {
    return this.service.createPoll(matchUniqueId, captain, dto);
  }

  @Get('matches/:matchUniqueId/availability')
  @UseGuards(CaptainJwtGuard)
  @ApiOperation({ operationId: 'getMatchAvailability' })
  @ApiOkResponse({ type: MatchAvailabilityDto })
  getMatchAvailability(
    @Param('matchUniqueId', ParseIntPipe) matchUniqueId: number,
    @CaptainUser() captain: CaptainPrincipal,
  ): Promise<MatchAvailabilityDto> {
    return this.service.getMatchAvailability(matchUniqueId, captain);
  }

  @Post('matches/:matchUniqueId/availability/response')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'submitAvailabilityResponse' })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  submitResponse(
    @Param('matchUniqueId', ParseIntPipe) matchUniqueId: number,
    @Body() dto: SubmitAvailabilityDto,
  ): Promise<AvailabilityResponseDto> {
    return this.service.submitResponse(matchUniqueId, dto);
  }

  @Get('player/:uniqueIndex/availability')
  @ApiOperation({ operationId: 'getPlayerAvailability' })
  @ApiOkResponse({ type: PlayerAvailabilityDto })
  getPlayerAvailability(
    @Param('uniqueIndex', ParseIntPipe) uniqueIndex: number,
  ): Promise<PlayerAvailabilityDto> {
    return this.service.getPlayerAvailability(uniqueIndex);
  }

  @Patch('matches/:matchUniqueId/availability/:uniqueIndex')
  @UseGuards(CaptainJwtGuard)
  @ApiOperation({ operationId: 'overrideAvailability' })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  override(
    @Param('matchUniqueId', ParseIntPipe) matchUniqueId: number,
    @Param('uniqueIndex', ParseIntPipe) uniqueIndex: number,
    @CaptainUser() captain: CaptainPrincipal,
    @Body() dto: OverrideAvailabilityDto,
  ): Promise<AvailabilityResponseDto> {
    return this.service.override(matchUniqueId, uniqueIndex, captain, dto);
  }

  @Post('matches/:matchUniqueId/availability/remind')
  @UseGuards(CaptainJwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'remindAvailability' })
  @ApiOkResponse({ type: RemindAvailabilityResultDto })
  remind(
    @Param('matchUniqueId', ParseIntPipe) matchUniqueId: number,
    @CaptainUser() captain: CaptainPrincipal,
  ): Promise<RemindAvailabilityResultDto> {
    return this.service.remind(matchUniqueId, captain);
  }
}
