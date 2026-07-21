import { ConfigService } from '@nestjs/config';
import { SocksProxyHttpClient } from './socks-proxy-http-client';

describe('SocksProxyHttpClient', () => {
  it('starts without proxy settings when the proxy is disabled', () => {
    const config = new ConfigService({ USE_SOCKS_PROXY: 'false' });

    expect(() => new SocksProxyHttpClient(config)).not.toThrow();
  });

  it('fails fast when the proxy is enabled without a complete address', () => {
    const config = new ConfigService({ USE_SOCKS_PROXY: 'true' });

    expect(() => new SocksProxyHttpClient(config)).toThrow(
      'SOCKS_PROXY_HOST and SOCKS_PROXY_PORT are required',
    );
  });

  it('configures an agent when the proxy address is complete', () => {
    const config = new ConfigService({
      USE_SOCKS_PROXY: 'true',
      SOCKS_PROXY_HOST: 'torproxy',
      SOCKS_PROXY_PORT: '9050',
    });

    expect(() => new SocksProxyHttpClient(config)).not.toThrow();
  });
});
