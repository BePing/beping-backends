import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MembersListSyncModule } from './aftt-data-members-list/members-list-sync.module';
import { ResultsSyncModule } from './aftt-data-results-list/results-sync.module';
import { CommonModule } from './common.module';
import { getRedisConnectionOptions } from '@app/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        return {
          connection: getRedisConnectionOptions((key) =>
            configService.get<string>(key),
          ),
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
