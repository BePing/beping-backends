import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import {
  SearchService,
  SearchResultDTO,
  SearchType,
} from '../../../services/search/search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search across members, clubs, and tournaments' })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Search query string',
    type: String,
  })
  @ApiQuery({
    name: 'types',
    required: false,
    description:
      'Comma-separated list of types to search (member,club,tournament). If not provided, searches all types.',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns search results for the specified types',
    type: SearchResultDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid search type provided',
  })
  async search(
    @Query('q') query: string,
    @Query('types') types?: string,
  ): Promise<SearchResultDTO> {
    if (!query) {
      throw new BadRequestException('Search query is required');
    }
    if (query.length < 3) {
      throw new BadRequestException(
        'Search query must be at least 3 characters long',
      );
    }
    let searchTypes: SearchType[] | undefined;

    if (types) {
      const requestedTypes = types
        .split(',')
        .map((t) => t.trim().toLowerCase());
      const validTypes = Object.values(SearchType);

      const invalidTypes = requestedTypes.filter(
        (t) => !validTypes.includes(t as SearchType),
      );

      if (invalidTypes.length) {
        throw new BadRequestException(
          `Invalid search type(s): ${invalidTypes.join(', ')}. Valid types are: ${validTypes.join(', ')}`,
        );
      }

      searchTypes = requestedTypes as SearchType[];
    }

    return this.searchService.search(query, searchTypes);
  }
}
