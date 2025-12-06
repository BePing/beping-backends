import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
} from '@nestjs/terminus';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TestRequestService } from '../../../services/test/test-request.service';
import { TestOutput } from '../../../entity/tabt-soap/TabTAPI_Port';
import { TabtHeadersDecorator } from '../../../common/decorators/tabt-headers.decorator';
import { ContextService } from '../../../common/context/context.service';
import { SocksProxyHttpClient } from '../../../common/socks-proxy/socks-proxy-http-client';
import { ConfigService } from '@nestjs/config';
import { UserAgentsUtil } from '../../../common/utils/user-agents.util';

@ApiTags('Health')
@Controller({
  path: 'health',
  version: '1',
})
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private healthIndicator: HttpHealthIndicator,
    private testRequest: TestRequestService,
    private contextService: ContextService,
    private readonly socksProxyService: SocksProxyHttpClient,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'checkHealth',
  })
  @HealthCheck()
  check() {
    const userAgent = UserAgentsUtil.random;
    return this.health.check([
      () =>
        this.healthIndicator.pingCheck(
          'AFTT API',
          'https://api.aftt.be/?wsdl',
          {
            headers: {
              'user-agent': userAgent,
            },
            httpsAgent:
              this.configService.get('USE_SOCKS_PROXY') === 'true'
                ? this.socksProxyService.createHttpsAgent()
                : undefined,
            timeout: 5000,
          },
        ),
      () =>
        this.healthIndicator.pingCheck(
          'VTTL API',
          'https://api.vttl.be/?wsdl',
          {
            headers: {
              'user-agent': userAgent,
            },
            httpsAgent:
              this.configService.get('USE_SOCKS_PROXY') === 'true'
                ? this.socksProxyService.createHttpsAgent()
                : undefined,
            timeout: 5000,
          },
        ),
    ]);
  }

  @Get('test')
  @ApiOperation({
    operationId: 'testRequest',
  })
  @ApiOkResponse({
    type: TestOutput,
    description: 'Test request',
  })
  @TabtHeadersDecorator()
  test() {
    return this.testRequest.testRequest();
  }

  @Get('context')
  @ApiOperation({
    operationId: 'context',
  })
  @TabtHeadersDecorator()
  context() {
    return this.contextService.context;
  }
}
