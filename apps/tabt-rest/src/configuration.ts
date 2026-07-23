type Environment = Record<string, unknown>;

const POSITIVE_INTEGER_DEFAULTS: Record<string, number> = {
  PORT: 3004,
  THROTTLE_TTL: 60_000,
  THROTTLE_LIMIT: 300,
  TRUST_PROXY_HOPS: 0,
  AFTT_HEAD2HEAD_TIMEOUT_MS: 5000,
  AFTT_MATCH_DETAILS_TIMEOUT_MS: 5000,
};

export function validateApiEnvironment(environment: Environment): Environment {
  const validated = { ...environment };

  for (const [key, defaultValue] of Object.entries(POSITIVE_INTEGER_DEFAULTS)) {
    const environmentDefault =
      key === 'TRUST_PROXY_HOPS' && environment.NODE_ENV === 'production'
        ? 1
        : defaultValue;
    const rawValue = environment[key] ?? environmentDefault;
    const value = Number(rawValue);
    const allowsZero = key === 'TRUST_PROXY_HOPS';
    if (!Number.isSafeInteger(value) || (allowsZero ? value < 0 : value <= 0)) {
      throw new Error(
        `${key} must be a ${allowsZero ? 'non-negative' : 'positive'} integer`,
      );
    }
    validated[key] = value;
  }

  for (const key of ['AFTT_WSDL', 'VTLL_WSDL']) {
    const rawValue = environment[key];
    if (rawValue !== undefined && rawValue !== '') {
      try {
        new URL(String(rawValue));
      } catch {
        throw new Error(`${key} must be a valid URL`);
      }
    }
  }

  if (environment.NODE_ENV === 'production') {
    const missing = [
      'DATABASE_URL',
      'AFTT_WSDL',
      'VTLL_WSDL',
      'CAPTAIN_JWT_SECRET',
      'CAPTAIN_JWT_REFRESH_SECRET',
      'PUBLIC_BASE_URL',
    ].filter((key) => !environment[key]);
    const hasRedis =
      !!environment.REDIS_URL ||
      !!environment.REDIS_TLS_URL ||
      !!environment.REDIS_HOST;
    if (!hasRedis) missing.push('REDIS_URL or REDIS_HOST');
    if (missing.length > 0) {
      throw new Error(
        `Missing required production configuration: ${missing.join(', ')}`,
      );
    }

    const accessSecret = String(environment.CAPTAIN_JWT_SECRET);
    const refreshSecret = String(environment.CAPTAIN_JWT_REFRESH_SECRET);
    if (accessSecret.length < 32 || refreshSecret.length < 32) {
      throw new Error(
        'Captain JWT secrets must each contain at least 32 characters',
      );
    }
    if (accessSecret === refreshSecret) {
      throw new Error(
        'Captain JWT access and refresh secrets must be distinct',
      );
    }

    const publicBaseUrl = new URL(String(environment.PUBLIC_BASE_URL));
    if (publicBaseUrl.protocol !== 'https:') {
      throw new Error('PUBLIC_BASE_URL must use HTTPS in production');
    }
  }

  validated.API_PREFIX = environment.API_PREFIX ?? '';
  return validated;
}
