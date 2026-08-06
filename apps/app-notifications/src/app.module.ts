import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './controllers/health.controller';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NotificationsController } from './controllers/notifications.controller';
import { EventsController } from './controllers/events.controller';
import { AllExceptionsFilter } from './common/filter/all-exceptions.filter';
import { PostHogRequestInterceptor, PostHogService } from '@app/common';

@Module({
  imports: [
    TerminusModule,
    AuthModule,
    CommonModule,
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      },
    }),
    ConfigModule.forRoot(),
    NotificationsModule,
  ],
  controllers: [HealthController, NotificationsController, EventsController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (posthog: PostHogService) =>
        new PostHogRequestInterceptor(posthog, 'app-notifications'),
      inject: [PostHogService],
    },
  ],
})
export class AppModule {}
