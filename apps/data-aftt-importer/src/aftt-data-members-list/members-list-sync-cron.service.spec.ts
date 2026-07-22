import { ConfigService } from '@nestjs/config';
import { MembersListSyncCron } from './members-list-sync-cron.service';

describe('MembersListSyncCron', () => {
  const queue = {
    add: jest.fn(),
    clean: jest.fn().mockResolvedValue([]),
    drain: jest.fn(),
    getJob: jest.fn().mockResolvedValue(null),
  };
  const config = { get: jest.fn().mockReturnValue(false) };
  const queueStatus = {
    getStatus: jest.fn().mockResolvedValue({
      totals: { waiting: 0, active: 0, delayed: 0 },
    }),
  };

  let service: MembersListSyncCron;

  beforeEach(() => {
    jest.clearAllMocks();
    queue.clean.mockResolvedValue([]);
    service = new MembersListSyncCron(
      queue as never,
      config as unknown as ConfigService,
      queueStatus as never,
    );
  });

  it('preserves waiting and delayed jobs on startup', async () => {
    await service.onModuleInit();

    expect(queue.drain).not.toHaveBeenCalled();
    expect(queue.clean).toHaveBeenCalledWith(
      24 * 60 * 60 * 1000,
      0,
      'completed',
    );
    expect(queue.clean).toHaveBeenCalledWith(24 * 60 * 60 * 1000, 0, 'failed');
  });

  it('uses stable daily ids for scheduled category jobs', async () => {
    queue.getJob
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing-men' })
      .mockResolvedValueOnce({ id: 'existing-women' });
    await service.syncMembers();
    await service.syncMembers();

    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add.mock.calls[0][2].jobId).toMatch(
      /^members-.+-\d{4}-\d{2}-\d{2}$/,
    );
  });
});
