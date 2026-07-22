import { validateApiEnvironment } from './configuration';

describe('validateApiEnvironment', () => {
  it('applies safe numeric defaults', () => {
    expect(validateApiEnvironment({})).toEqual(
      expect.objectContaining({
        PORT: 3004,
        THROTTLE_TTL: 60_000,
        THROTTLE_LIMIT: 300,
        TRUST_PROXY_HOPS: 0,
        AFTT_HEAD2HEAD_TIMEOUT_MS: 5000,
        AFTT_MATCH_DETAILS_TIMEOUT_MS: 5000,
      }),
    );
  });

  it.each(['PORT', 'THROTTLE_TTL', 'THROTTLE_LIMIT'])(
    'rejects an invalid %s',
    (key) => {
      expect(() => validateApiEnvironment({ [key]: 'invalid' })).toThrow(key);
    },
  );

  it('requires core dependencies in production', () => {
    expect(() => validateApiEnvironment({ NODE_ENV: 'production' })).toThrow(
      'Missing required production configuration',
    );
  });

  it('accepts a complete production configuration', () => {
    expect(
      validateApiEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localhost/beping',
        REDIS_HOST: 'cache',
        AFTT_WSDL: 'https://api.aftt.be/?wsdl',
        VTLL_WSDL: 'https://api.vttl.be/?wsdl',
      }),
    ).toEqual(expect.objectContaining({ PORT: 3004 }));
  });
});
