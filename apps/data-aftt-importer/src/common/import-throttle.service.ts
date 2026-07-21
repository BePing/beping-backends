import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function readInteger(
  config: ConfigService,
  name: string,
  fallback: number,
  minimum = 0,
): number {
  const parsed = Number.parseInt(config.get<string>(name) || '', 10);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

@Injectable()
export class ImportThrottleService {
  private readonly logger = new Logger(ImportThrottleService.name);

  constructor(private readonly configService: ConfigService) {}

  async waitForCapacity(context: string): Promise<void> {
    const cooldownMs = readInteger(
      this.configService,
      'IMPORT_BATCH_COOLDOWN_MS',
      1_000,
    );
    if (cooldownMs > 0) {
      await this.sleep(cooldownMs);
    }

    const readinessUrl = this.configService.get<string>(
      'IMPORT_API_READINESS_URL',
    );
    if (!readinessUrl) {
      return;
    }

    const timeoutMs = readInteger(
      this.configService,
      'IMPORT_API_HEALTH_TIMEOUT_MS',
      2_000,
      1,
    );
    const maxLatencyMs = readInteger(
      this.configService,
      'IMPORT_API_MAX_LATENCY_MS',
      750,
      1,
    );
    const pressurePauseMs = readInteger(
      this.configService,
      'IMPORT_PRESSURE_PAUSE_MS',
      5_000,
    );
    const maxAttempts = readInteger(
      this.configService,
      'IMPORT_PRESSURE_MAX_ATTEMPTS',
      60,
      1,
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startedAt = Date.now();

      try {
        const response = await fetch(readinessUrl, {
          signal: AbortSignal.timeout(timeoutMs),
        });
        const latencyMs = Date.now() - startedAt;

        if (response.ok && latencyMs <= maxLatencyMs) {
          return;
        }

        this.logger.warn(
          `Pausing ${context}: API readiness status=${response.status}, latency=${latencyMs}ms (attempt ${attempt}/${maxAttempts})`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Pausing ${context}: API readiness unavailable (${message}, attempt ${attempt}/${maxAttempts})`,
        );
      }

      if (attempt < maxAttempts && pressurePauseMs > 0) {
        await this.sleep(pressurePauseMs);
      }
    }

    throw new Error(
      `Import paused too long because the API remained under pressure during ${context}`,
    );
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
