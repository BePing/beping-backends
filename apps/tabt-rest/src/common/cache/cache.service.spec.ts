import { Test, TestingModule } from '@nestjs/testing';
import { CacheService, TTL_DURATION } from '@app/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

describe('CacheService', () => {
  let provider: CacheService;
  let cache: Cache;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    provider = module.get<CacheService>(CacheService);
    cache = module.get<Cache>(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(cache).toBeDefined();
    expect(provider).toBeDefined();
  });

  describe('getFromCache', () => {
    it('should query the cache with the given key', () => {
      const spy = jest.spyOn(cache, 'get');
      const key = 'aaa';

      provider.getFromCache(key);

      expect(spy).toHaveBeenCalledWith('aaa');
    });
  });

  describe('setInCache', () => {
    it('should convert the TTL from seconds to milliseconds before calling the cache manager', async () => {
      const spy = jest.spyOn(cache, 'set');

      await provider.setInCache('aaa', 'bbb', 10);

      // 10 seconds -> 10_000 milliseconds, passed as the third positional arg.
      expect(spy).toHaveBeenCalledWith('aaa', 'bbb', 10_000);
    });

    it('should convert a TTL_DURATION enum value (seconds) to milliseconds', async () => {
      const spy = jest.spyOn(cache, 'set');

      await provider.setInCache('aaa', 'bbb', TTL_DURATION.ONE_HOUR);

      expect(spy).toHaveBeenCalledWith(
        'aaa',
        'bbb',
        TTL_DURATION.ONE_HOUR * 1000,
      );
      expect(spy).toHaveBeenCalledWith('aaa', 'bbb', 3_600_000);
    });

    it('should pass undefined when no TTL is provided', async () => {
      const spy = jest.spyOn(cache, 'set');

      await provider.setInCache('aaa', 'bbb');

      expect(spy).toHaveBeenCalledWith('aaa', 'bbb', undefined);
    });
  });

  describe('getCacheKey', () => {
    it('should return a correct cache key', () => {
      const result = provider.getCacheKey('ccc', { test: 'ABC' }, 'bbb');

      expect(result).toBe('ccc-bbb-{"test":"ABC"}');
    });
  });

  describe('hashKey', () => {
    it('should return a stable md5 hash of the key', () => {
      expect(CacheService.hashKey('aaa')).toBe(CacheService.hashKey('aaa'));
      expect(CacheService.hashKey('aaa')).toHaveLength(32);
    });
  });

  describe('cleanKeys', () => {
    const makeKeyv = (storedKeys: string[]) => {
      const del = jest.fn();
      const keyv = {
        async *iterator() {
          for (const key of storedKeys) {
            yield [key, 'value'];
          }
        },
        delete: del,
      };
      return { keyv, del };
    };

    it('should delete only the logical keys matching the glob pattern', async () => {
      const { keyv, del } = makeKeyv([
        'numeric-ranking-v4:a',
        'numeric-ranking-v4:b',
        'search:a',
      ]);
      const service = new CacheService({ stores: [keyv] } as any);

      await service.cleanKeys('numeric-ranking-v4:*');

      expect(del).toHaveBeenCalledTimes(1);
      expect(del).toHaveBeenCalledWith([
        'numeric-ranking-v4:a',
        'numeric-ranking-v4:b',
      ]);
    });

    it('should not call delete when no key matches the pattern', async () => {
      const { keyv, del } = makeKeyv(['search:a']);
      const service = new CacheService({ stores: [keyv] } as any);

      await service.cleanKeys('numeric-ranking-v4:*');

      expect(del).not.toHaveBeenCalled();
    });

    it('should scan once for several patterns', async () => {
      let iterations = 0;
      const del = jest.fn();
      const keyv = {
        async *iterator() {
          iterations += 1;
          yield ['numeric-ranking-v4:a', 'value'];
          yield ['search:a', 'value'];
          yield ['unrelated:a', 'value'];
        },
        delete: del,
      };
      const service = new CacheService({ stores: [keyv] } as any);

      await service.cleanKeys(['numeric-ranking-v4:*', 'search:*']);

      expect(iterations).toBe(1);
      expect(del).toHaveBeenCalledWith(['numeric-ranking-v4:a', 'search:a']);
    });

    it('should warn and no-op when the store does not support iteration', async () => {
      const service = new CacheService({ stores: [{}] } as any);

      await expect(service.cleanKeys('search:*')).resolves.toBeUndefined();
    });
  });

  describe('getFromCacheOrGetAndCacheResult', () => {
    it('should return it from cache if it s already cached', async () => {
      const key = 'aaa';
      const value = 'bbb';
      const ttl = 10;
      const getter = jest.fn();

      const getSpy = jest.spyOn(cache, 'get').mockResolvedValue(value);
      const setSpy = jest.spyOn(cache, 'set');

      const result = await provider.getFromCacheOrGetAndCacheResult(
        key,
        getter,
        ttl,
      );

      expect(result).toBe(value);
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('aaa');
      expect(setSpy).toHaveBeenCalledTimes(0);
      expect(getter).toHaveBeenCalledTimes(0);
    });

    it('should use the getter if key not in cache and store with the default TTL in milliseconds', async () => {
      const key = 'aaa';
      const value = 'bbb';
      const getter = jest.fn().mockResolvedValue(value);

      const getSpy = jest.spyOn(cache, 'get').mockResolvedValue(null);
      const setSpy = jest.spyOn(cache, 'set');

      const result = await provider.getFromCacheOrGetAndCacheResult(
        key,
        getter,
      );

      expect(result).toBe(value);
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('aaa');
      expect(setSpy).toHaveBeenCalledTimes(1);
      // default ttl is 600 seconds -> 600_000 milliseconds.
      expect(setSpy).toHaveBeenCalledWith('aaa', value, 600_000);
      expect(getter).toHaveBeenCalledTimes(1);
    });

    it('should coalesce concurrent cache misses for the same key', async () => {
      const getter = jest.fn().mockResolvedValue('value');
      jest.spyOn(cache, 'get').mockResolvedValue(null);

      const results = await Promise.all([
        provider.getFromCacheOrGetAndCacheResult('same-key', getter),
        provider.getFromCacheOrGetAndCacheResult('same-key', getter),
        provider.getFromCacheOrGetAndCacheResult('same-key', getter),
      ]);

      expect(results).toEqual(['value', 'value', 'value']);
      expect(getter).toHaveBeenCalledTimes(1);
      expect(cache.set).toHaveBeenCalledTimes(1);
    });

    it('should treat false as a cached value', async () => {
      const getter = jest.fn();
      jest.spyOn(cache, 'get').mockResolvedValue(false);

      await expect(
        provider.getFromCacheOrGetAndCacheResult('boolean-key', getter),
      ).resolves.toBe(false);

      expect(getter).not.toHaveBeenCalled();
    });
  });
});
