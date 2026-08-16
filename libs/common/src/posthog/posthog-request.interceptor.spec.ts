import { CallHandler, ExecutionContext, HttpException } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import {
  getPostHogDomainEvent,
  getPostHogRequestContext,
  PostHogRequestInterceptor,
} from './posthog-request.interceptor';
import { PostHogService } from './posthog.service';

describe('PostHog request analytics', () => {
  const request = {
    headers: {
      'x-posthog-distinct-id': 'mobile-user-1',
      'x-posthog-session-id': 'session-1',
    },
    method: 'GET',
    path: '/v1/members/42',
    route: { path: '/v1/members/:id' },
  };

  it('extracts mobile correlation headers and a route template', () => {
    expect(getPostHogRequestContext(request, 'tabt-rest')).toEqual({
      distinctId: 'mobile-user-1',
      properties: {
        source: 'tabt-rest',
        request_method: 'GET',
        request_route: '/v1/members/:id',
        $session_id: 'session-1',
      },
    });
  });

  it('uses one stable anonymous id and sanitizes fallback paths', () => {
    expect(
      getPostHogRequestContext(
        { method: 'GET', path: '/v1/members/42' },
        'tabt-rest',
      ),
    ).toEqual({
      distinctId: 'tabt-rest:anonymous',
      properties: {
        source: 'tabt-rest',
        request_method: 'GET',
        request_route: '/v1/members/:id',
      },
    });
  });

  it('keeps error reporting safe when no HTTP request is available', () => {
    expect(getPostHogRequestContext(undefined, 'app-notifications')).toEqual({
      distinctId: 'app-notifications:anonymous',
      properties: {
        source: 'app-notifications',
        request_method: undefined,
        request_route: 'unknown',
      },
    });
  });

  it('captures a completed request with duration and status', async () => {
    const posthog = { capture: jest.fn(), log: jest.fn() };
    const interceptor = new PostHogRequestInterceptor(
      posthog as unknown as PostHogService,
      'tabt-rest',
    );
    const context = httpContext(request, { statusCode: 200 });
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    await lastValueFrom(interceptor.intercept(context, handler));

    expect(posthog.capture).toHaveBeenCalledWith(
      'api_request_completed',
      'mobile-user-1',
      expect.objectContaining({
        source: 'tabt-rest',
        request_route: '/v1/members/:id',
        status_code: 200,
        success: true,
        duration_ms: expect.any(Number),
      }),
    );
  });

  it('captures failed requests with the exception status', async () => {
    const posthog = { capture: jest.fn(), log: jest.fn() };
    const interceptor = new PostHogRequestInterceptor(
      posthog as unknown as PostHogService,
      'tabt-rest',
    );
    const context = httpContext(request, { statusCode: 200 });
    const handler: CallHandler = {
      handle: () => throwError(() => new HttpException('nope', 503)),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, handler)),
    ).rejects.toBeInstanceOf(HttpException);

    expect(posthog.capture).toHaveBeenCalledWith(
      'api_request_completed',
      'mobile-user-1',
      expect.objectContaining({ status_code: 503, success: false }),
    );
    expect(posthog.capture).toHaveBeenCalledTimes(1);
    expect(posthog.log).toHaveBeenCalledWith(
      'backend http request completed',
      'error',
      expect.objectContaining({
        posthogDistinctId: 'mobile-user-1',
        sessionId: 'session-1',
        outcome: 'failure',
        'http.response.status_code': 503,
      }),
    );
  });

  it('maps successful Captain writes without copying sensitive fields', () => {
    expect(
      getPostHogDomainEvent(
        {
          method: 'POST',
          baseUrl: '/v1/captain',
          route: { path: '/matches/:matchUniqueId/convocation/respond' },
          params: { matchUniqueId: '123' },
          body: {
            uniqueIndex: 456,
            status: 'CONFIRMED',
            responseToken: 'secret-token',
          },
        },
        200,
      ),
    ).toEqual({
      eventName: 'captain_convocation_response_confirmed',
      properties: { match_id: '123', status: 'CONFIRMED' },
    });
  });

  it('does not confirm failed Captain writes', () => {
    expect(
      getPostHogDomainEvent(
        {
          method: 'POST',
          path: '/v1/captain/auth/login',
          body: { account: 'user', password: 'secret' },
        },
        401,
      ),
    ).toBeUndefined();
  });

  it('captures a second server-confirmed business event', async () => {
    const posthog = { capture: jest.fn(), log: jest.fn() };
    const interceptor = new PostHogRequestInterceptor(
      posthog as unknown as PostHogService,
      'tabt-rest',
    );
    const context = httpContext(
      {
        ...request,
        method: 'PUT',
        baseUrl: '/v1/captain',
        route: { path: '/matches/:matchUniqueId/lineup' },
        params: { matchUniqueId: '123' },
        body: { slots: [{ uniqueIndex: 1 }, { uniqueIndex: 2 }] },
      },
      { statusCode: 200 },
    );

    await lastValueFrom(
      interceptor.intercept(context, { handle: () => of({ ok: true }) }),
    );

    expect(posthog.capture).toHaveBeenNthCalledWith(
      2,
      'captain_lineup_saved_confirmed',
      'mobile-user-1',
      expect.objectContaining({
        source: 'tabt-rest',
        match_id: '123',
        slot_count: 2,
        status_code: 200,
      }),
    );
  });
});

function httpContext(request: object, response: object): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}
