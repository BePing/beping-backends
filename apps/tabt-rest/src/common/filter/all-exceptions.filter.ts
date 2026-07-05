import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { PostHogService } from '@app/common';

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
      this.posthog.captureException(exception, undefined, {
        source: 'tabt-rest',
      });
    }

    super.catch(exception, host);
  }
}
