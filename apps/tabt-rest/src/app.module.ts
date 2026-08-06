import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ServicesModule } from './services/services.module';
import { CommonModule } from './common/common.module';
import { ApiModule } from './api/api.module';
import { CaptainModule } from './captain/captain.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filter/all-exceptions.filter';
import { validateApiEnvironment } from './configuration';
import { PostHogRequestInterceptor, PostHogService } from '@app/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateApiEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.getOrThrow<number>('THROTTLE_TTL'),
          limit: configService.getOrThrow<number>('THROTTLE_LIMIT'),
        },
      ],
    }),
    ServicesModule,
    CommonModule,
    ApiModule,
    CaptainModule,
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
    {
      provide: APP_INTERCEPTOR,
      useFactory: (posthog: PostHogService) =>
        new PostHogRequestInterceptor(posthog, 'tabt-rest'),
      inject: [PostHogService],
    },
  ],
})
export class AppModule {}
