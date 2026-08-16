import { Module } from '@nestjs/common';
import { ResultsSyncCronService } from './results-sync-cron.service';
import { ResultsProcessorService } from './results-processor.service';

export const RESULTS_SYNC_QUEUE = 'results';
@Module({
  providers: [ResultsSyncCronService, ResultsProcessorService],
})
export class ResultsSyncModule {}
