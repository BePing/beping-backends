import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { MemberDashboardService } from './member-dashboard.service';

describe('MemberDashboardService', () => {
  const cacheService = {
    getFromCacheOrGetAndCacheResult: jest.fn(
      (_key: string, getter: () => Promise<unknown>) => getter(),
    ),
  };
  const memberService = { getMembersV1: jest.fn() };
  const service = new MemberDashboardService(
    {} as never,
    cacheService as never,
    memberService as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('uses a typed 404 when the member does not exist', async () => {
    memberService.getMembersV1.mockResolvedValue([]);

    await expect(service.getDashboard(123)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('uses a typed 503 when a required dependency fails', async () => {
    memberService.getMembersV1.mockRejectedValue(new Error('SOAP down'));

    await expect(service.getDashboard(123)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('converts a single-dashboard cache failure to a typed 503', async () => {
    cacheService.getFromCacheOrGetAndCacheResult.mockRejectedValueOnce(
      new Error('Redis down'),
    );

    await expect(service.getDashboard(123)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('converts a multi-category cache failure to a typed 503', async () => {
    cacheService.getFromCacheOrGetAndCacheResult.mockRejectedValueOnce(
      new Error('Redis down'),
    );

    await expect(service.getMultiCategoryDashboard(123)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('preserves a not-found error returned through the cache layer', async () => {
    cacheService.getFromCacheOrGetAndCacheResult.mockRejectedValueOnce(
      new NotFoundException('missing'),
    );

    await expect(service.getDashboard(123)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
