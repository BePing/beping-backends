import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CaptainConvocationService } from './captain-convocation.service';
import { CaptainJwtGuard, CaptainPrincipal } from '../auth/captain-jwt.guard';
import { CaptainUser } from '../auth/captain-user.decorator';
import {
  ConvocationDto,
  ConvocationResponseDto,
  RespondConvocationDto,
  SendConvocationDto,
} from '../dto/convocation.dto';

@ApiTags('Captain')
@Controller({ path: 'captain', version: '1' })
export class CaptainConvocationController {
  constructor(private readonly service: CaptainConvocationService) {}

  @Post('matches/:matchUniqueId/convocation')
  @UseGuards(CaptainJwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ operationId: 'sendConvocation' })
  @ApiOkResponse({ type: ConvocationDto })
  send(
    @Param('matchUniqueId', ParseIntPipe) matchUniqueId: number,
    @CaptainUser() captain: CaptainPrincipal,
    @Body() dto: SendConvocationDto,
  ): Promise<ConvocationDto> {
    return this.service.sendConvocation(matchUniqueId, captain, dto);
  }

  @Get('matches/:matchUniqueId/convocation')
  @UseGuards(CaptainJwtGuard)
  @ApiOperation({ operationId: 'getConvocation' })
  @ApiOkResponse({ type: ConvocationDto })
  get(
    @Param('matchUniqueId', ParseIntPipe) matchUniqueId: number,
    @CaptainUser() captain: CaptainPrincipal,
  ): Promise<ConvocationDto> {
    return this.service.getConvocation(matchUniqueId, captain);
  }

  @Post('matches/:matchUniqueId/convocation/respond')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'respondConvocation' })
  @ApiOkResponse({ type: ConvocationResponseDto })
  respond(
    @Param('matchUniqueId', ParseIntPipe) matchUniqueId: number,
    @Body() dto: RespondConvocationDto,
  ): Promise<ConvocationResponseDto> {
    return this.service.respond(matchUniqueId, dto);
  }
}
