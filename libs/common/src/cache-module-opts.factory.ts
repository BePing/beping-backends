import { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/cache-manager';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';
import { getRedisConnectionUrl } from './redis/redis-connection';

@Injectable()
export class CacheModuleOptsFactory implements CacheOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createCacheOptions(): CacheModuleOptions<Record<string, any>> {
    const url = getRedisConnectionUrl((key) =>
      this.configService.get<string>(key),
    );
    if (url) {
      return { stores: [createKeyv(url)] };
    }

    // No Redis configured: cache-manager v7 falls back to an in-memory Keyv store.
    return {};
  }
}
