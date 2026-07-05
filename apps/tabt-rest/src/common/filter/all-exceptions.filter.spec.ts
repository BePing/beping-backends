import {
  ArgumentsHost,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { PostHogService } from '@app/common';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let posthog: { captureException: jest.Mock };
  let superCatch: jest.SpyInstance;

  beforeEach(() => {
    posthog = { captureException: jest.fn() };
    filter = new AllExceptionsFilter(posthog as unknown as PostHogService);
    // Stub the default BaseExceptionFilter handling: it needs an http adapter
    // that is only available at runtime, and this suite only asserts reporting.
    superCatch = jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const host = {} as ArgumentsHost;

  it('reports 500 HttpExceptions to PostHog and delegates', () => {
    const exception = new HttpException('boom', 500);

    filter.catch(exception, host);

    expect(posthog.captureException).toHaveBeenCalledTimes(1);
    expect(posthog.captureException).toHaveBeenCalledWith(
      exception,
      undefined,
      {
        source: 'tabt-rest',
      },
    );
    expect(superCatch).toHaveBeenCalledWith(exception, host);
  });

  it('reports non-HttpException errors (treated as 500) to PostHog', () => {
    const exception = new Error('unexpected');

    filter.catch(exception, host);

    expect(posthog.captureException).toHaveBeenCalledTimes(1);
    expect(posthog.captureException).toHaveBeenCalledWith(
      exception,
      undefined,
      {
        source: 'tabt-rest',
      },
    );
    expect(superCatch).toHaveBeenCalledWith(exception, host);
  });

  it('does NOT report 4xx HttpExceptions but still delegates', () => {
    const exception = new NotFoundException('missing');

    filter.catch(exception, host);

    expect(posthog.captureException).not.toHaveBeenCalled();
    expect(superCatch).toHaveBeenCalledWith(exception, host);
  });
});
