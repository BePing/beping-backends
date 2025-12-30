import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

// Durations in Seconds

export enum TTL_DURATION {
  ONE_DAY = 86_400,
  TWO_DAYS = 172_000,
  FIFTEEN_DAYS = 1_296_000,
  EIGHT_HOURS = 28_800,
  TWELVE_HOURS = 43_200,
  ONE_HOUR = 3_600,
  TWO_HOURS = 7_200,
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getFromCache<T>(key: string): Promise<T> {
    const value = (await this.cacheManager.get(key)) as unknown as Promise<
      T | undefined
    >;
    return value;
  }

  setInCache(key: string, value: any, ttl?: number): Promise<void> {
    return this.cacheManager.set(key, value, { ttl } as any) as Promise<void>;
  }

  async getFromCacheOrGetAndCacheResult<T>(
    key: string,
    getter: () => Promise<T>,
    ttl = 600,
  ): Promise<T> {
    const cached = await this.getFromCache<T>(key);

    if (cached) {
      return cached;
    }

    const result = await getter();
    await this.setInCache(key, result, ttl);
    return result;
  }

  async cleanKeys(pattern: string): Promise<void> {
    // In cache-manager v6, store is accessed differently
    const store = (this.cacheManager as any).store;
    if (!store || !store.keys) {
      return;
    }
    const keys = await store.keys(pattern);
    for (const key of keys) {
      await this.cacheManager.del(key);
    }
  }
}
