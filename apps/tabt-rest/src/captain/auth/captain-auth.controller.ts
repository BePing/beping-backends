import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CaptainAuthService } from './captain-auth.service';
import {
  CaptainLoginDto,
  CaptainRefreshDto,
  CaptainSessionDto,
} from '../dto/captain-auth.dto';

@ApiTags('Captain')
@Controller({ path: 'captain/auth', version: '1' })
export class CaptainAuthController {
  constructor(private readonly authService: CaptainAuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'captainLogin' })
  @ApiOkResponse({ type: CaptainSessionDto })
  login(@Body() dto: CaptainLoginDto): Promise<CaptainSessionDto> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'captainRefresh' })
  @ApiOkResponse({ type: CaptainSessionDto })
  refresh(@Body() dto: CaptainRefreshDto): Promise<CaptainSessionDto> {
    return this.authService.refresh(dto.refreshToken);
  }
}
