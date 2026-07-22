import { BadRequestException } from '@nestjs/common';
import {
  SearchService,
  SearchType,
} from '../../../services/search/search.service';
import { SearchController } from './search.controller';

describe('SearchController', () => {
  const searchService = { search: jest.fn().mockResolvedValue({}) };
  const controller = new SearchController(
    searchService as unknown as SearchService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('trims the query before searching', async () => {
    await controller.search('  John  ', SearchType.MEMBER);

    expect(searchService.search).toHaveBeenCalledWith('John', [
      SearchType.MEMBER,
    ]);
  });

  it('rejects queries longer than 100 characters', async () => {
    await expect(controller.search('a'.repeat(101))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(searchService.search).not.toHaveBeenCalled();
  });

  it('rejects array-shaped query parameters', async () => {
    await expect(
      controller.search(['john'] as unknown as string),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
