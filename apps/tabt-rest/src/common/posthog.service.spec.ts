import { PostHog } from 'posthog-node';
import { PostHogService } from '@app/common';

jest.mock('posthog-node', () => {
  return {
    PostHog: jest.fn().mockImplementation(() => ({
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
        host: 'https://eu.i.posthog.com',
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
        source: 'test',
      });
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
});
