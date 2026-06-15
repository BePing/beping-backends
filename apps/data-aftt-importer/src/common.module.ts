import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PrismaService } from './prisma.service';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheModuleOptsFactory } from '../../tabt-rest/src/common/cache/cache-module-opts.factory';
import { CacheService } from './cache/cache.service';
import { ImportExecutionCoordinatorService } from './common/import-execution-coordinator.service';
import { ImportQueueStatusService } from './common/import-queue-status.service';
import { PostgresCopyService } from './common/postgres-copy.service';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'members',
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      },
      {
        name: 'results',
        limiter: {
          max: 1,
          duration: 100000,
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      },
    ),
    HttpModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        return {
          timeout: 30000,
          baseURL: configService.get('AFTT_DATA_BASE_URL'),
          auth: {
            username: configService.get('AFTT_DATA_USERNAME'),
            password: configService.get('AFTT_DATA_PASSWORD'),
          },
        };
      },
      inject: [ConfigService],
    }),
    ClientsModule.registerAsync({
      clients: [
        {
          name: 'BEPING_NOTIFIER',
          useFactory: (configService: ConfigService) => {
            return {
              transport: Transport.REDIS,
              options: {
                host: configService.get('REDIS_HOST'),
                port: parseInt(configService.get('REDIS_PORT')),
              },
            };
          },
          inject: [ConfigService],
          imports: [ConfigModule],
        },
      ],
    }),
    CacheModule.registerAsync({
      useClass: CacheModuleOptsFactory,
      imports: [ConfigModule],
    }),
  ],
  providers: [
    PrismaService,
    CacheService,
    ImportExecutionCoordinatorService,
    ImportQueueStatusService,
    PostgresCopyService,
  ],
  exports: [
    BullModule,
    HttpModule,
    PrismaService,
    CacheService,
    ClientsModule,
    ImportExecutionCoordinatorService,
    ImportQueueStatusService,
    PostgresCopyService,
  ],
})
export class CommonModule {}
