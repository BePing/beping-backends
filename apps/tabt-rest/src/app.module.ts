import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ServicesModule } from './services/services.module';
import { CommonModule } from './common/common.module';
import { ApiModule } from './api/api.module';
import { ConfigModule } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filter/all-exceptions.filter';

const THROTTLE_TTL = Number(process.env.THROTTLE_TTL ?? 60_000);
const THROTTLE_LIMIT = Number(process.env.THROTTLE_LIMIT ?? 300);

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: THROTTLE_TTL,
        limit: THROTTLE_LIMIT,
      },
    ]),
    ServicesModule,
    CommonModule,
    ApiModule,
    ConfigModule.forRoot(),
  ],
  providers: [
    // Global catch-all filter: reports 5xx (including TabtException SOAP faults,
    // which are HttpExceptions) to PostHog, then delegates to Nest's default
    // handling. TabtException already carries the mapped HTTP status.
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
