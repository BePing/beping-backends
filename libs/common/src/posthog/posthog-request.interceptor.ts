import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { PostHogService } from './posthog.service';

type HeaderValue = string | string[] | undefined;

export interface PostHogHttpRequest {
  headers?: Record<string, HeaderValue>;
  method?: string;
  path?: string;
  url?: string;
  baseUrl?: string;
  route?: { path?: string };
  params?: Record<string, string | undefined>;
  body?: unknown;
}

export interface PostHogRequestContext {
  distinctId: string;
  properties: Record<string, unknown>;
}

export interface PostHogDomainEvent {
  eventName: string;
  properties: Record<string, unknown>;
}

function firstHeader(value: HeaderValue): string | undefined {
  const header = Array.isArray(value) ? value[0] : value;
  const trimmed = header?.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizedPath(request: PostHogHttpRequest): string {
  const routePath = request.route?.path;
  if (routePath) return `${request.baseUrl ?? ''}${routePath}`;

  return (request.path ?? request.url ?? 'unknown')
    .split('?')[0]
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi,
      '/:id',
    )
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

function isObservabilityProbe(request: PostHogHttpRequest): boolean {
  const path = sanitizedPath(request).replace(/\/+/g, '/');
  return /^\/(?:v\d+\/)?(?:health|metrics)(?:\/|$)/.test(path);
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Converts successful Captain write endpoints into low-cardinality business
 * confirmations. Only an allowlist of non-sensitive body fields is copied:
 * credentials, response tokens, notes, messages and player ids never leave
 * the request process through this instrumentation.
 */
export function getPostHogDomainEvent(
  request: PostHogHttpRequest,
  statusCode: number,
): PostHogDomainEvent | undefined {
  if (statusCode < 200 || statusCode >= 300) return undefined;

  const method = request.method?.toUpperCase();
  const route = sanitizedPath(request).replace(/\/+/g, '/');
  const body = record(request.body);
  const matchId = request.params?.matchUniqueId;
  const matchProperties = matchId ? { match_id: matchId } : {};
  const status = typeof body.status === 'string' ? body.status : undefined;

  if (method === 'POST' && route.endsWith('/captain/auth/login')) {
    return { eventName: 'captain_auth_confirmed', properties: {} };
  }
  if (
    method === 'POST' &&
    /\/captain\/matches\/:[^/]+\/availability-poll$/.test(route)
  ) {
    return {
      eventName: 'captain_availability_poll_created',
      properties: {
        ...matchProperties,
        roster_size: Array.isArray(body.rosterUniqueIndexes)
          ? body.rosterUniqueIndexes.length
          : undefined,
      },
    };
  }
  if (
    method === 'POST' &&
    /\/captain\/matches\/:[^/]+\/availability\/response$/.test(route)
  ) {
    return {
      eventName: 'captain_availability_response_confirmed',
      properties: { ...matchProperties, status },
    };
  }
  if (
    method === 'PATCH' &&
    /\/captain\/matches\/:[^/]+\/availability\/:[^/]+$/.test(route)
  ) {
    return {
      eventName: 'captain_availability_override_confirmed',
      properties: { ...matchProperties, status },
    };
  }
  if (
    method === 'POST' &&
    /\/captain\/matches\/:[^/]+\/availability\/remind$/.test(route)
  ) {
    return {
      eventName: 'captain_availability_reminder_confirmed',
      properties: matchProperties,
    };
  }
  if (method === 'PUT' && /\/captain\/matches\/:[^/]+\/lineup$/.test(route)) {
    return {
      eventName: 'captain_lineup_saved_confirmed',
      properties: {
        ...matchProperties,
        slot_count: Array.isArray(body.slots) ? body.slots.length : undefined,
      },
    };
  }
  if (
    method === 'POST' &&
    /\/captain\/matches\/:[^/]+\/lineup\/validate$/.test(route)
  ) {
    return {
      eventName: 'captain_lineup_validated_confirmed',
      properties: {
        ...matchProperties,
        override_warnings: body.overrideWarnings === true,
      },
    };
  }
  if (
    method === 'POST' &&
    /\/captain\/matches\/:[^/]+\/convocation$/.test(route)
  ) {
    return {
      eventName: 'captain_convocation_sent_confirmed',
      properties: {
        ...matchProperties,
        has_meeting_time:
          typeof body.meetingTime === 'string' && body.meetingTime.length > 0,
        has_venue: typeof body.venue === 'string' && body.venue.length > 0,
      },
    };
  }
  if (
    method === 'POST' &&
    /\/captain\/matches\/:[^/]+\/convocation\/respond$/.test(route)
  ) {
    return {
      eventName: 'captain_convocation_response_confirmed',
      properties: { ...matchProperties, status },
    };
  }

  return undefined;
}

export function getPostHogRequestContext(
  request: PostHogHttpRequest | undefined,
  source: string,
): PostHogRequestContext {
  const safeRequest = request ?? {};
  const distinctId =
    firstHeader(safeRequest.headers?.['x-posthog-distinct-id']) ??
    `${source}:anonymous`;
  const sessionId = firstHeader(safeRequest.headers?.['x-posthog-session-id']);

  return {
    distinctId,
    properties: {
      source,
      request_method: safeRequest.method,
      request_route: sanitizedPath(safeRequest),
      ...(sessionId ? { $session_id: sessionId } : {}),
    },
  };
}

function errorStatus(error: unknown): number | undefined {
  if (
    error &&
    typeof error === 'object' &&
    'getStatus' in error &&
    typeof error.getStatus === 'function'
  ) {
    const status = error.getStatus();
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function boundedNumber(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : fallback;
}

/** Emits sampled request logs plus an optional business confirmation event. */
export class PostHogRequestInterceptor implements NestInterceptor {
  private readonly slowRequestThresholdMs = boundedNumber(
    process.env.POSTHOG_SLOW_REQUEST_MS,
    2000,
    250,
    30000,
  );
  private readonly successfulRequestSampleRate = boundedNumber(
    process.env.POSTHOG_LOG_SUCCESS_SAMPLE_RATE,
    0.02,
    0,
    1,
  );

  constructor(
    private readonly posthog: PostHogService,
    private readonly source: string,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<PostHogHttpRequest>();
    const response = http.getResponse<{ statusCode?: number }>();
    if (isObservabilityProbe(request)) {
      return next.handle();
    }

    const startedAt = performance.now();
    let failedStatus: number | undefined;

    return next.handle().pipe(
      tap({
        error: (error: unknown) => {
          failedStatus = errorStatus(error) ?? 500;
        },
      }),
      finalize(() => {
        const statusCode = failedStatus ?? response.statusCode ?? 200;
        const requestContext = getPostHogRequestContext(request, this.source);
        const durationMs = Math.round(performance.now() - startedAt);
        const isSlow = durationMs > this.slowRequestThresholdMs;
        if (
          statusCode >= 400 ||
          isSlow ||
          Math.random() < this.successfulRequestSampleRate
        ) {
          const sessionId = requestContext.properties.$session_id;
          this.posthog.log(
            'backend http request completed',
            statusCode >= 500
              ? 'error'
              : statusCode >= 400 || isSlow
                ? 'warn'
                : 'info',
            {
              event: 'http.request.completed',
              source: this.source,
              posthogDistinctId: requestContext.distinctId,
              sessionId: typeof sessionId === 'string' ? sessionId : undefined,
              'http.request.method': request.method,
              'http.route': requestContext.properties.request_route as string,
              'http.response.status_code': statusCode,
              duration_ms: durationMs,
              outcome: statusCode < 400 ? 'success' : 'failure',
            },
          );
        }
        const domainEvent = getPostHogDomainEvent(request, statusCode);
        if (domainEvent) {
          this.posthog.capture(
            domainEvent.eventName,
            requestContext.distinctId,
            {
              ...requestContext.properties,
              ...domainEvent.properties,
              status_code: statusCode,
            },
          );
        }
      }),
    );
  }
}
