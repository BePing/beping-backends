import { getRedisConnectionOptions, getRedisConnectionUrl } from '@app/common';

function reader(values: Record<string, string | undefined>) {
  return (key: string) => values[key];
}

describe('Redis connection configuration', () => {
  it('parses a TLS URL with encoded credentials', () => {
    const options = getRedisConnectionOptions(
      reader({
        REDIS_URL: 'rediss://user%40app:p%40ss@redis.internal:6380',
      }),
    );

    expect(options).toEqual({
      host: 'redis.internal',
      port: 6380,
      username: 'user@app',
      password: 'p@ss',
      tls: {},
    });
  });

  it('builds options from discrete variables', () => {
    const options = getRedisConnectionOptions(
      reader({
        REDIS_HOST: 'cache',
        REDIS_PORT: '6379',
        REDIS_USERNAME: 'app',
        REDIS_PASSWORD: 'secret',
      }),
    );

    expect(options).toEqual({
      host: 'cache',
      port: 6379,
      username: 'app',
      password: 'secret',
    });
  });

  it('builds an encoded URL for the cache store', () => {
    const url = getRedisConnectionUrl(
      reader({
        REDIS_HOST: 'cache',
        REDIS_PORT: 'invalid',
        REDIS_USERNAME: 'app user',
        REDIS_PASSWORD: 'p@ss word',
        REDIS_TLS: 'true',
      }),
    );

    expect(url).toBe('rediss://app%20user:p%40ss%20word@cache:6379');
  });

  it('returns no cache URL when Redis is not configured', () => {
    expect(getRedisConnectionUrl(reader({}))).toBeUndefined();
    expect(getRedisConnectionOptions(reader({}))).toEqual({
      host: 'localhost',
      port: 6379,
    });
  });
});
