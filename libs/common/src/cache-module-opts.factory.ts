import { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/cache-manager';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import memoryStore from 'cache-manager-memory-store';
import { redisStore } from 'cache-manager-redis-store';

@Injectable()
export class CacheModuleOptsFactory implements CacheOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  async createCacheOptions(): Promise<CacheModuleOptions<Record<string, any>>> {
    const tlsUrl = this.configService.get('REDIS_TLS_URL');
    if (tlsUrl) {
      return {
        store: (await redisStore({ url: tlsUrl })) as unknown as any,
      };
    }

    if (
      this.configService.get('REDIS_HOST') &&
      this.configService.get('REDIS_PORT')
    ) {
      return {
        store: (await redisStore({
          url: `redis://${this.configService.get('REDIS_HOST')}:${this.configService.get('REDIS_PORT')}`,
        })) as unknown as any,
      };
    }

    return {
      store: memoryStore,
    };
  }
}
