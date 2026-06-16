import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue, JobOptions } from 'bull';
import { PlayerCategory } from '@app/common';
import { ConfigService } from '@nestjs/config';
import { ImportQueueStatusService } from '../common/import-queue-status.service';

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
  private readonly JOB_OPTIONS: JobOptions = {
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
    // Always drain stale jobs on startup to prevent queue buildup
    await this.drainStaleJobs();

    const syncOnStart = this.configService.get('SYNC_RESULTS_ON_START', false);
    if (syncOnStart === true || syncOnStart === 'true') {
      const delayMs = 10000;
      this.logger.log(
        `Results sync scheduled to start in ${delayMs / 1000}s...`,
      );
      setTimeout(() => this.syncResults(), delayMs);
    } else {
      this.logger.log('SYNC_RESULTS_ON_START is not enabled.');
    }
  }

  /**
   * Drain stale waiting/delayed jobs on startup
   */
  private async drainStaleJobs(): Promise<void> {
    const status = await this.getQueueStatus();

    if (status.waiting > 0 || status.delayed > 0) {
      this.logger.warn(
        `Draining stale jobs on startup: waiting=${status.waiting}, delayed=${status.delayed}`,
      );

      // Remove all waiting and delayed jobs
      await this.queue.empty();

      // Also clean old completed/failed
      await Promise.all([
        this.queue.clean(0, 'delayed'),
        this.queue.clean(0, 'wait'),
      ]);

      this.logger.log('Queue drained successfully');
    }
  }

  // Run every hour at 45 minutes past the hour
  @Cron('0 45 * * * *')
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
  ): Promise<void> {
    const jobId = `results-${playerCategory}-${Date.now()}`;

    const options: JobOptions = {
      ...this.JOB_OPTIONS,
      jobId,
      delay: delayMs,
    };

    await this.queue.add({ playerCategory }, options);

    this.logger.log(
      `Added job ${jobId} for ${playerCategory}${delayMs > 0 ? ` (delayed ${delayMs}ms)` : ''}`,
    );
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

    await this.addJobForCategory(playerCategory);
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
      this.queue.clean(gracePeriod, 'completed'),
      this.queue.clean(gracePeriod, 'failed'),
    ]);

    const cleaned = completedCleaned.length + failedCleaned.length;
    if (cleaned > 0) {
      this.logger.log(`Cleaned ${cleaned} old jobs from queue`);
    }

    return { cleaned };
  }
}
