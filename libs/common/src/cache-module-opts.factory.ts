import { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/cache-manager';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';

@Injectable()
export class CacheModuleOptsFactory implements CacheOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createCacheOptions(): CacheModuleOptions<Record<string, any>> {
    const tlsUrl = this.configService.get<string>('REDIS_TLS_URL');
    if (tlsUrl) {
      return { stores: [createKeyv(tlsUrl)] };
    }

    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<string>('REDIS_PORT');
    if (host && port) {
      return { stores: [createKeyv(`redis://${host}:${port}`)] };
    }

    // No Redis configured: cache-manager v7 falls back to an in-memory Keyv store.
    return {};
  }
}
