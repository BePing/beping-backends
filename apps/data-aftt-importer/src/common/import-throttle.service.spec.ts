import { ConfigService } from '@nestjs/config';
import { ImportThrottleService } from './import-throttle.service';

describe('ImportThrottleService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('only applies the configured cooldown when no API guard is configured', async () => {
    const service = new ImportThrottleService(
      new ConfigService({ IMPORT_BATCH_COOLDOWN_MS: '0' }),
    );

    await expect(
      service.waitForCapacity('test batch'),
    ).resolves.toBeUndefined();
  });

  it('continues when the API is ready within the latency budget', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const service = new ImportThrottleService(
      new ConfigService({
        IMPORT_BATCH_COOLDOWN_MS: '0',
        IMPORT_API_READINESS_URL: 'https://api.example/ready',
        IMPORT_API_MAX_LATENCY_MS: '1000',
      }),
    );

    await expect(
      service.waitForCapacity('test batch'),
    ).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example/ready',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('stops the import when the API remains unavailable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const service = new ImportThrottleService(
      new ConfigService({
        IMPORT_BATCH_COOLDOWN_MS: '0',
        IMPORT_API_READINESS_URL: 'https://api.example/ready',
        IMPORT_PRESSURE_PAUSE_MS: '0',
        IMPORT_PRESSURE_MAX_ATTEMPTS: '1',
      }),
    );

    await expect(service.waitForCapacity('test batch')).rejects.toThrow(
      'API remained under pressure',
    );
  });
});
