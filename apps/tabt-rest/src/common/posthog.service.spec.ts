import { PostHog } from 'posthog-node';
import { PostHogService } from '@app/common';

jest.mock('posthog-node', () => {
  return {
    PostHog: jest.fn().mockImplementation(() => ({
      capture: jest.fn(),
      captureException: jest.fn(),
      shutdown: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

const PostHogMock = PostHog as unknown as jest.Mock;

describe('PostHogService', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    delete process.env.POSTHOG_API_KEY;
    delete process.env.POSTHOG_HOST;
    delete process.env.POSTHOG_LOGS_ENABLED;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('no-op mode (no POSTHOG_API_KEY)', () => {
    it('does not instantiate a client', () => {
      new PostHogService();
      expect(PostHogMock).not.toHaveBeenCalled();
    });

    it('captureException is a safe no-op', () => {
      const service = new PostHogService();
      expect(() =>
        service.captureException(new Error('boom'), 'user-1', { a: 1 }),
      ).not.toThrow();
    });

    it('capture is a safe no-op', () => {
      const service = new PostHogService();
      expect(() =>
        service.capture('captain_lineup_saved_confirmed', 'user-1'),
      ).not.toThrow();
    });

    it('log is a safe no-op', () => {
      const service = new PostHogService();
      expect(() =>
        service.log('request completed', 'info', { status_code: 200 }),
      ).not.toThrow();
    });

    it('onApplicationShutdown resolves without a client', async () => {
      const service = new PostHogService();
      await expect(service.onApplicationShutdown()).resolves.toBeUndefined();
    });
  });

  describe('configured mode (POSTHOG_API_KEY set)', () => {
    it('instantiates the client with the default host', () => {
      process.env.POSTHOG_API_KEY = 'phc_test';
      new PostHogService();
      expect(PostHogMock).toHaveBeenCalledWith('phc_test', {
        host: 'https://t.beping.be',
      });
    });

    it('honours a custom POSTHOG_HOST', () => {
      process.env.POSTHOG_API_KEY = 'phc_test';
      process.env.POSTHOG_HOST = 'https://us.i.posthog.com';
      new PostHogService();
      expect(PostHogMock).toHaveBeenCalledWith('phc_test', {
        host: 'https://us.i.posthog.com',
      });
    });

    it('delegates captureException to the client', () => {
      process.env.POSTHOG_API_KEY = 'phc_test';
      const service = new PostHogService();
      const client = PostHogMock.mock.results[0].value;
      const error = new Error('boom');

      service.captureException(error, 'user-1', { source: 'test' });

      expect(client.captureException).toHaveBeenCalledWith(error, 'user-1', {
        $process_person_profile: false,
        source: 'test',
      });
    });

    it('captures product events without creating person profiles', () => {
      process.env.POSTHOG_API_KEY = 'phc_test';
      const service = new PostHogService();
      const client = PostHogMock.mock.results[0].value;

      service.capture('captain_lineup_saved_confirmed', 'user-1', {
        match_id: 'match-1',
      });

      expect(client.capture).toHaveBeenCalledWith({
        event: 'captain_lineup_saved_confirmed',
        distinctId: 'user-1',
        properties: {
          $process_person_profile: false,
          match_id: 'match-1',
        },
      });
    });

    it('keeps technical logs out of product analytics events', () => {
      process.env.POSTHOG_API_KEY = 'phc_test';
      process.env.POSTHOG_LOGS_ENABLED = 'false';
      const service = new PostHogService();
      const client = PostHogMock.mock.results[0].value;

      service.log('backend http request completed', 'info', {
        event: 'http.request.completed',
        'http.response.status_code': 200,
      });

      expect(client.capture).not.toHaveBeenCalled();
    });

    it('uses a stable anonymous id when exception context has no id', () => {
      process.env.POSTHOG_API_KEY = 'phc_test';
      const service = new PostHogService();
      const client = PostHogMock.mock.results[0].value;
      const error = new Error('boom');

      service.captureException(error, undefined, { source: 'tabt-rest' });

      expect(client.captureException).toHaveBeenCalledWith(
        error,
        'tabt-rest:anonymous',
        {
          $process_person_profile: false,
          source: 'tabt-rest',
        },
      );
    });

    it('swallows client errors in captureException', () => {
      process.env.POSTHOG_API_KEY = 'phc_test';
      const service = new PostHogService();
      const client = PostHogMock.mock.results[0].value;
      client.captureException.mockImplementation(() => {
        throw new Error('network down');
      });

      expect(() => service.captureException(new Error('boom'))).not.toThrow();
    });

    it('shuts the client down on application shutdown', async () => {
      process.env.POSTHOG_API_KEY = 'phc_test';
      const service = new PostHogService();
      const client = PostHogMock.mock.results[0].value;

      await service.onApplicationShutdown();

      expect(client.shutdown).toHaveBeenCalledTimes(1);
    });
  });

  it('fails loudly in development when POSTHOG_API_KEY is missing', () => {
    process.env.NODE_ENV = 'development';
    expect(() => new PostHogService()).toThrow(
      'POSTHOG_API_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_API_KEY is configured',
    );
  });
});
