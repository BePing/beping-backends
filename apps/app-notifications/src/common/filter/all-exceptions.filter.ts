import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import {
  getPostHogRequestContext,
  PostHogHttpRequest,
  PostHogService,
} from '@app/common';

/**
 * Global catch-all filter. Reports server-side failures (HTTP status >= 500
 * and any non-HttpException error) to PostHog, then delegates to Nest's
 * default exception handling so the client-facing response is unchanged.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  constructor(private readonly posthog: PostHogService) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    if (status >= 500) {
      const request = host.switchToHttp().getRequest<PostHogHttpRequest>();
      const context = getPostHogRequestContext(request, 'app-notifications');
      this.posthog.captureException(exception, context.distinctId, {
        ...context.properties,
        status_code: status,
      });
    }

    super.catch(exception, host);
  }
}
