import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import { PlayerCategory } from '@app/common';
import { ConfigService } from '@nestjs/config';
import { ImportQueueStatusService } from '../common/import-queue-status.service';
import { randomUUID } from 'node:crypto';

interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

@Injectable()
export class ResultsSyncCronService implements OnModuleInit {
  private readonly logger = new Logger(ResultsSyncCronService.name);

  // Stagger delay between category jobs (ms)
  private readonly STAGGER_DELAY_MS = 5000;

  // Job options for better reliability
  private readonly JOB_OPTIONS: JobsOptions = {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60000, // 1 minute initial delay
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
  };

  constructor(
    @InjectQueue('results') private readonly queue: Queue,
    private readonly configService: ConfigService,
    private readonly importQueueStatusService: ImportQueueStatusService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Waiting and delayed jobs are durable work and must survive deployments.
    // Only prune old terminal jobs on startup.
    await this.cleanOldJobs();

    const syncOnStart = this.configService.get('SYNC_RESULTS_ON_START', false);
    if (syncOnStart === true || syncOnStart === 'true') {
      const delayMs = 10000;
      this.logger.log(
        `Results sync scheduled to start in ${delayMs / 1000}s...`,
      );
      setTimeout(() => {
        void this.syncResults().catch((error) =>
          this.logger.error('Startup results sync failed', error),
        );
      }, delayMs);
    } else {
      this.logger.log('SYNC_RESULTS_ON_START is not enabled.');
    }
  }

  // Run once per night, after the member import window.
  @Cron(process.env.RESULTS_IMPORT_CRON || '0 0 2 * * *', {
    timeZone: process.env.IMPORT_TIME_ZONE || 'Europe/Brussels',
  })
  async syncResults(): Promise<void> {
    const status = await this.importQueueStatusService.getStatus();
    this.logger.log(
      `Results sync triggered - Global queue status: waiting=${status.totals.waiting}, active=${status.totals.active}, delayed=${status.totals.delayed}`,
    );

    // Skip if there are already jobs being processed or pending
    if (status.totals.active > 0) {
      this.logger.warn(
        `Skipping sync - ${status.totals.active} job(s) already active. Will retry next cycle.`,
      );
      return;
    }

    if (status.totals.waiting > 0 || status.totals.delayed > 0) {
      this.logger.warn(
        `Skipping sync - jobs already pending (waiting=${status.totals.waiting}, delayed=${status.totals.delayed}). Will retry next cycle.`,
      );
      return;
    }

    await this.scheduleAllCategories();
  }

  /**
   * Schedule jobs for all player categories with staggered delays
   */
  private async scheduleAllCategories(): Promise<void> {
    const categories = [PlayerCategory.SENIOR_MEN, PlayerCategory.SENIOR_WOMEN];

    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const delay = i * this.STAGGER_DELAY_MS;

      await this.addJobForCategory(category, delay);
    }

    this.logger.log(
      `Scheduled ${categories.length} result sync jobs with ${this.STAGGER_DELAY_MS}ms stagger`,
    );
  }

  /**
   * Add a job for a specific player category
   */
  private async addJobForCategory(
    playerCategory: PlayerCategory,
    delayMs: number = 0,
    runKey: string = this.currentImportDate(),
  ): Promise<void> {
    const jobId = `results-${playerCategory}-${runKey}`;

    if (await this.queue.getJob(jobId)) {
      this.logger.log(`Job ${jobId} is already scheduled; skipping duplicate`);
      return;
    }

    const options: JobsOptions = {
      ...this.JOB_OPTIONS,
      jobId,
      delay: delayMs,
    };

    await this.queue.add('results', { playerCategory }, options);

    this.logger.log(
      `Added job ${jobId} for ${playerCategory}${delayMs > 0 ? ` (delayed ${delayMs}ms)` : ''}`,
    );
  }

  private currentImportDate(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: process.env.IMPORT_TIME_ZONE || 'Europe/Brussels',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  /**
   * Get current queue status
   */
  private async getQueueStatus(): Promise<QueueStatus> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Manually trigger sync for a specific category (useful for testing/admin)
   */
  async triggerSyncForCategory(
    playerCategory: PlayerCategory,
  ): Promise<string> {
    const status = await this.getQueueStatus();

    if (status.active > 0 || status.waiting > 0) {
      const msg = `Cannot trigger sync - queue busy (active=${status.active}, waiting=${status.waiting})`;
      this.logger.warn(msg);
      return msg;
    }

    const runKey = `manual-${Date.now()}-${randomUUID()}`;
    await this.addJobForCategory(playerCategory, 0, runKey);
    return `Sync triggered for ${playerCategory}`;
  }

  /**
   * Get queue health info (useful for monitoring endpoints)
   */
  async getQueueHealth(): Promise<{
    status: 'healthy' | 'busy' | 'backlogged';
    details: QueueStatus;
  }> {
    const details = await this.getQueueStatus();

    let status: 'healthy' | 'busy' | 'backlogged' = 'healthy';
    if (details.active > 0) {
      status = 'busy';
    }
    if (details.waiting > 5 || details.failed > 10) {
      status = 'backlogged';
    }

    return { status, details };
  }

  /**
   * Clean old completed/failed jobs (can be called periodically or manually)
   */
  async cleanOldJobs(): Promise<{ cleaned: number }> {
    const gracePeriod = 24 * 60 * 60 * 1000; // 24 hours

    const [completedCleaned, failedCleaned] = await Promise.all([
      this.queue.clean(gracePeriod, 0, 'completed'),
      this.queue.clean(gracePeriod, 0, 'failed'),
    ]);

    const cleaned = completedCleaned.length + failedCleaned.length;
    if (cleaned > 0) {
      this.logger.log(`Cleaned ${cleaned} old jobs from queue`);
    }

    return { cleaned };
  }
}
