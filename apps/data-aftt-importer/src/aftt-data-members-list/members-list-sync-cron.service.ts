import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { JobOptions, Queue } from 'bull';
import { PlayerCategory } from '@app/common';
import { ConfigService } from '@nestjs/config';
import { ImportQueueStatusService } from '../common/import-queue-status.service';

@Injectable()
export class MembersListSyncCron implements OnModuleInit {
  private readonly logger = new Logger(MembersListSyncCron.name);
  private readonly STARTUP_DELAY_MS = 30000;
  private readonly STAGGER_DELAY_MS = 15000;
  private readonly JOB_OPTIONS: JobOptions = {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  };

  constructor(
    @InjectQueue('members') private readonly queue: Queue,
    private readonly configService: ConfigService,
    private readonly importQueueStatusService: ImportQueueStatusService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.drainStaleJobs();

    const syncOnStart = this.configService.get('SYNC_MEMBERS_ON_START', false);
    if (syncOnStart === true || syncOnStart === 'true') {
      this.logger.log(
        `Members sync scheduled to start in ${this.STARTUP_DELAY_MS / 1000}s...`,
      );
      setTimeout(() => {
        void this.syncMembers();
      }, this.STARTUP_DELAY_MS);
    } else {
      this.logger.log('SYNC_MEMBERS_ON_START is not enabled. ');
    }
  }

  // Run every hour at 15 minutes past the hour to avoid colliding with results.
  @Cron('0 15 * * * *')
  async syncMembers() {
    const status = await this.importQueueStatusService.getStatus();
    this.logger.log(
      `Members sync triggered - Global queue status: waiting=${status.totals.waiting}, active=${status.totals.active}, delayed=${status.totals.delayed}`,
    );

    if (
      status.totals.active > 0 ||
      status.totals.waiting > 0 ||
      status.totals.delayed > 0
    ) {
      this.logger.warn(
        `Skipping members sync - importer already busy (waiting=${status.totals.waiting}, active=${status.totals.active}, delayed=${status.totals.delayed}).`,
      );
      return;
    }

    await this.addJobForCategory(PlayerCategory.SENIOR_MEN, 0);
    await this.addJobForCategory(
      PlayerCategory.SENIOR_WOMEN,
      this.STAGGER_DELAY_MS,
    );
  }

  private async addJobForCategory(
    playerCategory: PlayerCategory,
    delayMs: number,
  ): Promise<void> {
    const jobId = `members-${playerCategory}-${Date.now()}`;

    await this.queue.add(
      { playerCategory },
      {
        ...this.JOB_OPTIONS,
        jobId,
        delay: delayMs,
      },
    );

    this.logger.log(
      `Added job ${jobId} for ${playerCategory}${delayMs > 0 ? ` (delayed ${delayMs}ms)` : ''}`,
    );
  }

  private async drainStaleJobs(): Promise<void> {
    const [waiting, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getDelayedCount(),
    ]);

    if (waiting === 0 && delayed === 0) {
      return;
    }

    this.logger.warn(
      `Draining stale member jobs on startup: waiting=${waiting}, delayed=${delayed}`,
    );

    await this.queue.empty();
    await Promise.all([
      this.queue.clean(0, 'delayed'),
      this.queue.clean(0, 'wait'),
    ]);

    this.logger.log('Members queue drained successfully');
  }

  /*
    https://data.aftt.be/export/liste_joueurs_1.txt
    https://data.aftt.be/export/liste_joueurs_2.txt
    https://data.aftt.be/export/liste_result_1.txt
    https://data.aftt.be/export/liste_result_2.txt
     */
}
