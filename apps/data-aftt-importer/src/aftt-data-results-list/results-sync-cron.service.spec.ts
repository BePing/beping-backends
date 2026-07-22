import { ConfigService } from '@nestjs/config';
import { PlayerCategory } from '@app/common';
import { ResultsSyncCronService } from './results-sync-cron.service';

describe('ResultsSyncCronService', () => {
  const queue = {
    add: jest.fn(),
    clean: jest.fn().mockResolvedValue([]),
    drain: jest.fn(),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    getJob: jest.fn().mockResolvedValue(null),
  };
  const config = { get: jest.fn().mockReturnValue(false) };
  const queueStatus = {
    getStatus: jest.fn().mockResolvedValue({
      totals: { waiting: 0, active: 0, delayed: 0 },
    }),
  };

  let service: ResultsSyncCronService;

  beforeEach(() => {
    jest.clearAllMocks();
    queue.clean.mockResolvedValue([]);
    service = new ResultsSyncCronService(
      queue as never,
      config as unknown as ConfigService,
      queueStatus as never,
    );
  });

  it('preserves waiting and delayed jobs on startup', async () => {
    await service.onModuleInit();

    expect(queue.drain).not.toHaveBeenCalled();
    expect(queue.clean).toHaveBeenCalledTimes(2);
    expect(queue.clean).toHaveBeenCalledWith(
      24 * 60 * 60 * 1000,
      0,
      'completed',
    );
    expect(queue.clean).toHaveBeenCalledWith(24 * 60 * 60 * 1000, 0, 'failed');
  });

  it('uses a unique id so a manual category sync can be relaunched', async () => {
    await service.triggerSyncForCategory(PlayerCategory.SENIOR_MEN);
    await service.triggerSyncForCategory(PlayerCategory.SENIOR_MEN);

    const firstOptions = queue.add.mock.calls[0][2];
    const secondOptions = queue.add.mock.calls[1][2];
    expect(firstOptions.jobId).toMatch(/^results-.+-manual-/);
    expect(secondOptions.jobId).not.toBe(firstOptions.jobId);
  });

  it('deduplicates scheduled jobs for the same import day', async () => {
    queue.getJob
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing-men' })
      .mockResolvedValueOnce({ id: 'existing-women' });

    await service.syncResults();
    await service.syncResults();

    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add.mock.calls[0][2].jobId).toMatch(
      /^results-.+-\d{4}-\d{2}-\d{2}$/,
    );
  });
});
