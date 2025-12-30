import { createHash } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

// Durations in Seconds

export enum TTL_DURATION {
  ONE_WEEK = 14_515_200,
  ONE_DAY = 86_400,
  EIGHT_HOURS = 28_800,
  TWELVE_HOURS = 43_200,
  ONE_HOUR = 3_600,
  TWO_HOURS = 7_200,
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  private static hashKey(key: string): string {
    return createHash('md5').update(key).digest('hex');
  }

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getFromCache<T>(key: string): Promise<T | undefined> {
    return await this.cacheManager.get(key);
  }

  async setInCache(key: string, value: object, ttl: number): Promise<void> {
    await this.cacheManager.set(key, value, { ttl } as any);
  }

  getCacheKey(prefix: string, input: object, db: string): string {
    return `${prefix}-${db}-${JSON.stringify(input)}`;
  }

  async getFromCacheOrGetAndCacheResult<T extends object>(
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
}
