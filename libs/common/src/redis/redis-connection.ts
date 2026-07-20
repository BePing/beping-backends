export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
}

type ConfigReader = (key: string) => string | undefined;

function parsePort(value: string | undefined): number {
  const port = Number.parseInt(value || '6379', 10);
  return Number.isFinite(port) && port > 0 ? port : 6379;
}

export function getRedisConnectionOptions(
  read: ConfigReader,
): RedisConnectionOptions {
  const configuredUrl = read('REDIS_URL') || read('REDIS_TLS_URL');
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    return {
      host: url.hostname,
      port: parsePort(url.port),
      ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    };
  }

  const username = read('REDIS_USERNAME');
  const password = read('REDIS_PASSWORD');
  const useTls = read('REDIS_TLS') === 'true';

  return {
    host: read('REDIS_HOST') || 'localhost',
    port: parsePort(read('REDIS_PORT')),
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    ...(useTls ? { tls: {} } : {}),
  };
}

export function getRedisConnectionUrl(read: ConfigReader): string | undefined {
  const configuredUrl = read('REDIS_URL') || read('REDIS_TLS_URL');
  if (configuredUrl) {
    return configuredUrl;
  }

  const host = read('REDIS_HOST');
  if (!host) {
    return undefined;
  }

  const protocol = read('REDIS_TLS') === 'true' ? 'rediss' : 'redis';
  const username = read('REDIS_USERNAME');
  const password = read('REDIS_PASSWORD');
  const credentials = password
    ? `${username ? `${encodeURIComponent(username)}:` : ':'}${encodeURIComponent(password)}@`
    : '';

  return `${protocol}://${credentials}${host}:${parsePort(read('REDIS_PORT'))}`;
}
