import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckResult,
  HealthCheckService,
  HttpHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '@app/common';
import { HealthController } from './health.controller';

describe('Notifications HealthController', () => {
  let controller: HealthController;
  let health: HealthCheckService;
  let http: HttpHealthIndicator;
  let prisma: PrismaHealthIndicator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: { check: jest.fn() } },
        { provide: HttpHealthIndicator, useValue: { pingCheck: jest.fn() } },
        { provide: PrismaHealthIndicator, useValue: { pingCheck: jest.fn() } },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get(HealthController);
    health = module.get(HealthCheckService);
    http = module.get(HttpHealthIndicator);
    prisma = module.get(PrismaHealthIndicator);
  });

  it('returns liveness without checking dependencies', () => {
    expect(controller.liveness()).toEqual({ status: 'ok' });
    expect(health.check).not.toHaveBeenCalled();
  });

  it('uses only PostgreSQL for readiness', () => {
    const prismaSpy = jest.spyOn(prisma, 'pingCheck');
    jest.spyOn(health, 'check').mockImplementation((checks) => {
      checks.forEach((check) => check());
      return {} as Promise<HealthCheckResult>;
    });

    controller.readiness();

    expect(prismaSpy).toHaveBeenCalledTimes(1);
    expect(http.pingCheck).not.toHaveBeenCalled();
  });
});
