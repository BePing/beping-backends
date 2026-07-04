import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CaptainHubService } from './captain-hub.service';
import { CaptainJwtGuard, CaptainPrincipal } from '../auth/captain-jwt.guard';
import { CaptainUser } from '../auth/captain-user.decorator';
import { CaptainHubDto } from '../dto/hub.dto';

@ApiTags('Captain')
@Controller({ path: 'captain', version: '1' })
export class CaptainHubController {
  constructor(private readonly service: CaptainHubService) {}

  @Get('hub')
  @UseGuards(CaptainJwtGuard)
  @ApiOperation({ operationId: 'getCaptainHub' })
  @ApiOkResponse({ type: CaptainHubDto })
  getHub(@CaptainUser() captain: CaptainPrincipal): Promise<CaptainHubDto> {
    return this.service.getHub(captain);
  }
}
