import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckResult,
  HealthCheckService,
  HttpHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { TestRequestService } from '../../../services/test/test-request.service';
import { ContextService } from '../../../common/context/context.service';
import { ConfigService } from '@nestjs/config';
import { SocksProxyHttpClient } from '../../../common/socks-proxy/socks-proxy-http-client';
import { PrismaService } from '@app/common';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let httpHealthIndicator: HttpHealthIndicator;
  let testService: TestRequestService;
  let contextService: ContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn(),
          },
        },
        {
          provide: HttpHealthIndicator,
          useValue: {
            pingCheck: jest.fn(),
          },
        },
        {
          provide: PrismaHealthIndicator,
          useValue: {
            pingCheck: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: TestRequestService,
          useValue: {
            testRequest: jest.fn(),
          },
        },
        {
          provide: ContextService,
          useValue: {
            context: {},
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: () => {
              return;
            },
          },
        },
        {
          provide: SocksProxyHttpClient,
          useValue: {
            context: {},
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    httpHealthIndicator = module.get<HttpHealthIndicator>(HttpHealthIndicator);
    testService = module.get<TestRequestService>(TestRequestService);
    contextService = module.get<ContextService>(ContextService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should ping both wsdl', () => {
    const dnsSpy = jest.spyOn(httpHealthIndicator, 'pingCheck');

    const checkSpy = jest
      .spyOn(healthCheckService, 'check')
      .mockImplementation((fns) => {
        fns.map((fn) => fn());
        return {} as Promise<HealthCheckResult>;
      });

    controller.check();
    expect(dnsSpy).toHaveBeenCalledTimes(2);
    expect(dnsSpy).toHaveBeenNthCalledWith(
      1,
      'AFTT API',
      'https://api.aftt.be/?wsdl',
      expect.anything(),
    );
    expect(dnsSpy).toHaveBeenNthCalledWith(
      2,
      'VTTL API',
      'https://api.vttl.be/?wsdl',
      expect.anything(),
    );
    expect(checkSpy).toHaveBeenCalledTimes(1);
  });

  it('should test the request', () => {
    const spy = jest.spyOn(testService, 'testRequest');

    controller.test();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should return the context', () => {
    const spy = Object.assign(contextService.context, {
      runner: {
        name: '123',
        version: '1',
        pid: 123,
      },
      caller: {
        correlationId: '123',
        remoteAddress: '123',
      },
    });

    const res = controller.context();
    expect(res).toEqual(spy);
  });
});
