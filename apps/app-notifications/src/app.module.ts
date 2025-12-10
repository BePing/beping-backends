import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './controllers/health.controller';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaService } from './common/prisma.service';
import { NotificationsController } from './controllers/notifications.controller';
import { EventsController } from './controllers/events.controller';

@Module({
  imports: [
    TerminusModule,
    AuthModule,
    CommonModule,
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'debug',
      },
    }),
    ConfigModule.forRoot(),
    NotificationsModule,
  ],
  controllers: [HealthController, NotificationsController, EventsController],
  providers: [PrismaService],
})
export class AppModule { }
