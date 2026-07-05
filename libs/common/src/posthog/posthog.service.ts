import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { PostHog } from 'posthog-node';

const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';

/**
 * Thin wrapper around the posthog-node client used for error tracking.
 *
 * When POSTHOG_API_KEY is not configured the service stays a no-op: no client
 * is created and every method is safe to call, so local dev / CI / tests never
 * crash or emit network traffic.
 */
@Injectable()
export class PostHogService implements OnApplicationShutdown {
  private readonly logger = new Logger(PostHogService.name);
  private readonly client: PostHog | null;

  constructor() {
    const apiKey = process.env.POSTHOG_API_KEY;
    if (!apiKey) {
      this.client = null;
      return;
    }
    this.client = new PostHog(apiKey, {
      host: process.env.POSTHOG_HOST || DEFAULT_POSTHOG_HOST,
    });
  }

  /**
   * Report an error to PostHog error tracking. No-op when PostHog is not
   * configured. Never throws — reporting must not break the request path.
   */
  captureException(
    error: unknown,
    distinctId?: string,
    extraProps?: Record<string | number, unknown>,
  ): void {
    if (!this.client) {
      return;
    }
    try {
      this.client.captureException(error, distinctId, extraProps);
    } catch (err) {
      this.logger.warn(`Failed to report exception to PostHog: ${err}`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.shutdown();
    } catch (err) {
      this.logger.warn(`Failed to shutdown PostHog client: ${err}`);
    }
  }
}
