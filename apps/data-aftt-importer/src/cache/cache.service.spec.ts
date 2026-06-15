import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
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
          useValue: { get: jest.fn(), set: jest.fn() },
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
    it('should set in the cache with the given params', async () => {
      const spy = jest.spyOn(cache, 'set');
      const key = 'aaa';
      const value = 'bbb';
      const ttl = 10;

      await provider.setInCache(key, value, ttl);

      expect(spy).toHaveBeenCalledWith(key, value, { ttl: 10 });
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

    it('should use the getter if key not in cache', async () => {
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
      expect(setSpy).toHaveBeenCalledWith('aaa', value, { ttl: 600 });
      expect(getter).toHaveBeenCalledTimes(1);
    });
  });
});
