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
}

export interface PostHogRequestContext {
  distinctId: string;
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

/** Captures one low-cardinality event for each non-health HTTP request. */
export class PostHogRequestInterceptor implements NestInterceptor {
  constructor(
    private readonly posthog: PostHogService,
    private readonly source: string,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<PostHogHttpRequest>();
    const response = http.getResponse<{ statusCode?: number }>();
    const path = request.path ?? request.url ?? '';
    if (path.startsWith('/health') || path.startsWith('/metrics')) {
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
        this.posthog.capture(
          'api_request_completed',
          requestContext.distinctId,
          {
            ...requestContext.properties,
            status_code: statusCode,
            success: statusCode < 400,
            duration_ms: Math.round(performance.now() - startedAt),
          },
        );
      }),
    );
  }
}
