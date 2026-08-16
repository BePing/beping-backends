import {
  Injectable,
  Logger as NestLogger,
  OnApplicationShutdown,
} from '@nestjs/common';
import {
  Logger as OtelLogger,
  SeverityNumber,
  logs,
} from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PostHog } from 'posthog-node';

const DEFAULT_POSTHOG_HOST = 'https://t.beping.be';

export type PostHogLogLevel = 'debug' | 'info' | 'warn' | 'error';
export type PostHogLogAttributes = Record<
  string,
  string | number | boolean | undefined
>;

const LOG_SEVERITIES: Record<
  PostHogLogLevel,
  { text: string; number: SeverityNumber }
> = {
  debug: { text: 'DEBUG', number: SeverityNumber.DEBUG },
  info: { text: 'INFO', number: SeverityNumber.INFO },
  warn: { text: 'WARN', number: SeverityNumber.WARN },
  error: { text: 'ERROR', number: SeverityNumber.ERROR },
};

/**
 * Thin wrapper around the posthog-node client used for product analytics and
 * error tracking.
 *
 * When POSTHOG_API_KEY is not configured the service stays a no-op: no client
 * is created and every method is safe to call, so local dev / CI / tests never
 * crash or emit network traffic.
 */
@Injectable()
export class PostHogService implements OnApplicationShutdown {
  private readonly logger = new NestLogger(PostHogService.name);
  private readonly client: PostHog | null;
  private logSdk: NodeSDK | null = null;
  private otelLogger: OtelLogger | null = null;

  constructor() {
    const apiKey = process.env.POSTHOG_API_KEY;
    if (!apiKey) {
      if (process.env.NODE_ENV === 'development') {
        throw new Error(
          'POSTHOG_API_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_API_KEY is configured',
        );
      }
      this.client = null;
      return;
    }
    const host = process.env.POSTHOG_HOST || DEFAULT_POSTHOG_HOST;
    this.client = new PostHog(apiKey, { host });
    this.initializeLogs(apiKey, host);
  }

  private initializeLogs(apiKey: string, host: string): void {
    const configured = process.env.POSTHOG_LOGS_ENABLED;
    const enabled = configured
      ? configured.toLowerCase() === 'true'
      : process.env.NODE_ENV === 'production';
    if (!enabled) return;

    try {
      const serviceName =
        process.env.POSTHOG_SERVICE_NAME?.trim() || 'beping-backend';
      const endpoint =
        process.env.POSTHOG_LOGS_ENDPOINT?.trim() ||
        `${host.replace(/\/$/, '')}/i/v1/logs`;
      this.logSdk = new NodeSDK({
        resource: resourceFromAttributes({
          'service.name': serviceName,
          'service.version':
            process.env.APP_VERSION ||
            process.env.GIT_SHA ||
            process.env.npm_package_version ||
            'development',
          'deployment.environment': process.env.NODE_ENV || 'development',
        }),
        logRecordProcessors: [
          new BatchLogRecordProcessor({
            exporter: new OTLPLogExporter({
              url: endpoint,
              headers: { Authorization: `Bearer ${apiKey}` },
            }),
          }),
        ],
      });
      this.logSdk.start();
      this.otelLogger = logs.getLogger(serviceName);
    } catch (error) {
      this.logSdk = null;
      this.otelLogger = null;
      this.logger.warn(`Failed to initialize PostHog Logs: ${error}`);
    }
  }

  /** Capture a backend product event without creating person profiles. */
  capture(
    event: string,
    distinctId: string,
    properties?: Record<string | number, unknown>,
  ): void {
    if (!this.client) return;
    try {
      this.client.capture({
        event,
        distinctId,
        properties: {
          $process_person_profile: false,
          ...properties,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to capture PostHog event: ${err}`);
    }
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
      const source = String(extraProps?.source ?? 'backend');
      this.client.captureException(
        error,
        distinctId?.trim() || `${source}:anonymous`,
        {
          $process_person_profile: false,
          ...extraProps,
        },
      );
    } catch (err) {
      this.logger.warn(`Failed to report exception to PostHog: ${err}`);
    }
  }

  /**
   * Emit a structured OTLP log. Callers pass scalar metadata only; secrets,
   * request bodies and response bodies must never be supplied.
   */
  log(
    body: string,
    level: PostHogLogLevel,
    attributes: PostHogLogAttributes = {},
  ): void {
    if (!this.otelLogger || !body.trim()) return;
    try {
      const severity = LOG_SEVERITIES[level];
      this.otelLogger.emit({
        eventName:
          typeof attributes.event === 'string' ? attributes.event : undefined,
        body,
        severityText: severity.text,
        severityNumber: severity.number,
        attributes: Object.fromEntries(
          Object.entries(attributes).filter(([, value]) => value !== undefined),
        ),
      });
    } catch (error) {
      this.logger.warn(`Failed to capture PostHog log: ${error}`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    const shutdowns: Promise<unknown>[] = [];
    if (this.client) shutdowns.push(this.client.shutdown());
    if (this.logSdk) shutdowns.push(this.logSdk.shutdown());
    const results = await Promise.allSettled(shutdowns);
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.warn(
          `Failed to shutdown PostHog telemetry: ${result.reason}`,
        );
      }
    }
  }
}
