import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

interface QueueSnapshot {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface GlobalImportQueueStatus {
  members: QueueSnapshot;
  results: QueueSnapshot;
  totals: QueueSnapshot;
}

@Injectable()
export class ImportQueueStatusService {
  constructor(
    @InjectQueue('members') private readonly membersQueue: Queue,
    @InjectQueue('results') private readonly resultsQueue: Queue,
  ) {}

  async getStatus(): Promise<GlobalImportQueueStatus> {
    const [members, results] = await Promise.all([
      this.getQueueSnapshot(this.membersQueue),
      this.getQueueSnapshot(this.resultsQueue),
    ]);

    return {
      members,
      results,
      totals: {
        waiting: members.waiting + results.waiting,
        active: members.active + results.active,
        completed: members.completed + results.completed,
        failed: members.failed + results.failed,
        delayed: members.delayed + results.delayed,
      },
    };
  }

  async hasPendingWork(): Promise<boolean> {
    const { totals } = await this.getStatus();

    return totals.waiting > 0 || totals.active > 0 || totals.delayed > 0;
  }

  private async getQueueSnapshot(queue: Queue): Promise<QueueSnapshot> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }
}
