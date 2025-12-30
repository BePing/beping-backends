import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { MembersListSyncModule } from './aftt-data-members-list/members-list-sync.module';
import { ResultsSyncModule } from './aftt-data-results-list/results-sync.module';
import { CommonModule } from './common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        return {
          redis: {
            host: configService.get('REDIS_HOST'),
            port: configService.get('REDIS_PORT'),
          },
        };
      },
      inject: [ConfigService],
    }),
    MembersListSyncModule,
    ResultsSyncModule,
    CommonModule,
  ],
})
export class DataAFTTImporterModule {}
