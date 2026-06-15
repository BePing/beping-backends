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
    this.logger.debug(`Get [${key}] in cache. Found in cache: ${!!value}`);
    return value;
  }

  setInCache(key: string, value: any, ttl?: number): Promise<void> {
    this.logger.debug(`Set [${key}] in cache. TTL: ${ttl}`);
    return this.cacheManager.set(key, value, { ttl } as any) as Promise<void>;
  }

  async getFromCacheOrGetAndCacheResult<T>(
    key: string,
    getter: () => Promise<T>,
    ttl = 600,
  ): Promise<T> {
    const cached = await this.getFromCache<T>(key);

    if (cached) {
      this.logger.debug('Data found in cache');
      return cached;
    }

    this.logger.debug('Data not found in cache');
    const result = await getter();
    await this.setInCache(key, result, ttl);
    return result;
  }

  async cleanKeys(pattern: string): Promise<void> {
    // In cache-manager v6, store is accessed through type assertion
    const cacheManagerAny = this.cacheManager as any;
    const store = cacheManagerAny.store || cacheManagerAny.stores?.[0];

    if (!store) {
      this.logger.warn('Store not available for pattern matching');
      return;
    }

    // Check if store supports keys method with pattern
    if (typeof store.keys === 'function') {
      try {
        const keys = await store.keys(pattern);
        this.logger.debug(
          `Cleaning cache for pattern ${pattern}. Found ${keys.length} keys.`,
        );

        // Try mdel first, fallback to individual deletes
        if (typeof store.mdel === 'function') {
          await store.mdel(...keys);
        } else {
          for (const key of keys) {
            await this.cacheManager.del(key);
          }
        }
      } catch (error) {
        this.logger.warn(`Error cleaning keys with pattern ${pattern}:`, error);
      }
    } else {
      this.logger.warn('Store does not support keys pattern matching');
    }
  }
}
