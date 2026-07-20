import { createHash } from 'crypto';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';

// Durations in seconds. Converted to milliseconds at the cacheManager.set
// call site (cache-manager v6/v7 expects the TTL as milliseconds).
export enum TTL_DURATION {
  ONE_HOUR = 3_600,
  TWO_HOURS = 7_200,
  EIGHT_HOURS = 28_800,
  TWELVE_HOURS = 43_200,
  ONE_DAY = 86_400,
  TWO_DAYS = 172_800,
  ONE_WEEK = 604_800,
  FIFTEEN_DAYS = 1_296_000,
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  static hashKey(key: string): string {
    return createHash('md5').update(key).digest('hex');
  }

  async getFromCache<T>(key: string): Promise<T> {
    const value = await this.cacheManager.get<T>(key);
    this.logger.debug(`Get [${key}] in cache. Found in cache: ${!!value}`);
    return value as T;
  }

  async setInCache(key: string, value: any, ttl?: number): Promise<void> {
    this.logger.debug(`Set [${key}] in cache. TTL: ${ttl}s`);
    // Public API is expressed in seconds; cache-manager expects milliseconds.
    const ttlMs = ttl === undefined ? undefined : ttl * 1000;
    await this.cacheManager.set(key, value, ttlMs);
  }

  getCacheKey(prefix: string, input: object, db: string): string {
    return `${prefix}-${db}-${JSON.stringify(input)}`;
  }

  async getFromCacheOrGetAndCacheResult<T>(
    key: string,
    getter: () => Promise<T>,
    ttl = 600,
  ): Promise<T> {
    const cached = await this.getFromCache<T>(key);

    if (cached !== undefined && cached !== null) {
      this.logger.debug('Data found in cache');
      return cached;
    }

    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    this.logger.debug('Data not found in cache');
    const pending = getter().then(async (result) => {
      await this.setInCache(key, result, ttl);
      return result;
    });
    this.inFlight.set(key, pending);

    try {
      return await pending;
    } finally {
      if (this.inFlight.get(key) === pending) {
        this.inFlight.delete(key);
      }
    }
  }

  async cleanKeys(pattern: string | string[]): Promise<void> {
    // In cache-manager v7 the underlying Keyv store(s) are reached through a
    // type assertion; the store is the first entry of `stores` (older layouts
    // exposed a single `store`).
    const cacheManagerAny = this.cacheManager as any;
    const keyv = cacheManagerAny.stores?.[0] ?? cacheManagerAny.store;

    if (!keyv || typeof keyv.iterator !== 'function') {
      this.logger.warn('Store does not support keys pattern matching');
      return;
    }

    try {
      // Keyv iterates logical (un-prefixed) keys, so the glob patterns match the
      // same keys as before. Collect the matches then delete them in one batch.
      const patterns = Array.isArray(pattern) ? pattern : [pattern];
      const regexes = patterns.map(CacheService.globToRegExp);
      const keys: string[] = [];
      for await (const [key] of keyv.iterator()) {
        if (regexes.some((regex) => regex.test(key))) {
          keys.push(key);
        }
      }

      if (keys.length === 0) {
        return;
      }
      this.logger.debug(
        `Cleaning cache for ${patterns.length} pattern(s). Found ${keys.length} keys.`,
      );

      // Keyv.delete re-applies the store's key prefix for each logical key.
      await keyv.delete(keys);
    } catch (error) {
      this.logger.warn('Error cleaning cache keys by pattern:', error);
    }
  }

  // Translates a Redis-style glob (only `*` is used as a wildcard in practice)
  // into an anchored RegExp, escaping every other regex metacharacter.
  private static globToRegExp(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`);
  }
}
