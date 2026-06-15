import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ImportExecutionCoordinatorService {
  private readonly logger = new Logger(ImportExecutionCoordinatorService.name);
  private queueTail: Promise<void> = Promise.resolve();
  private activeJob: string | null = null;

  async runExclusive<T>(jobLabel: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queueTail;
    let release!: () => void;

    this.queueTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    const queuedAt = Date.now();
    await previous;

    const waitTimeMs = Date.now() - queuedAt;
    if (waitTimeMs > 0) {
      this.logger.warn(
        `Import ${jobLabel} waited ${waitTimeMs}ms for another import to finish`,
      );
    }

    this.activeJob = jobLabel;
    this.logger.log(`Import ${jobLabel} acquired exclusive execution slot`);

    try {
      return await task();
    } finally {
      this.activeJob = null;
      release();
      this.logger.log(`Import ${jobLabel} released exclusive execution slot`);
    }
  }

  getActiveJob(): string | null {
    return this.activeJob;
  }
}
