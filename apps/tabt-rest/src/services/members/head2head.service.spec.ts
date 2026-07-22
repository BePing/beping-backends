import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';

import { Head2headService } from './head2head.service';
import { MatchService } from '../matches/match.service';
import { CacheService } from '@app/common';
import { SocksProxyHttpClient } from '../../common/socks-proxy/socks-proxy-http-client';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';

describe('Head2headService', () => {
  let service: Head2headService;

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockMatchService = {
    getMatches: jest.fn(),
  };

  const mockCacheService = {
    getFromCacheOrGetAndCacheResult: jest.fn(),
  };

  const mockSocksProxyService = {
    createHttpsAgent: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Head2headService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: MatchService, useValue: mockMatchService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: SocksProxyHttpClient, useValue: mockSocksProxyService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<Head2headService>(Head2headService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHead2HeadResults', () => {
    const mockHtmlResponse = `
      <input id="player_1" name="player_1" value="123/Player One">
      <input id="player_2" name="player_2" value="456/Player Two">
      <a href="?season=2023&sel=1&detail=123&week_name=1&div_id=1">Match 01/23</a>
    `;

    const mockMatchEntry = {
      MatchId: '01/23',
      Date: '2023-01-01',
      MatchDetails: {
        HomePlayers: {
          Players: [{ UniqueIndex: 123, Ranking: 'C0' }],
        },
        AwayPlayers: {
          Players: [{ UniqueIndex: 456, Ranking: 'C2' }],
        },
        IndividualMatchResults: [
          {
            HomePlayerUniqueIndex: [123],
            AwayPlayerUniqueIndex: [456],
            HomeSetCount: 3,
            AwaySetCount: 1,
          },
        ],
      },
    };

    beforeEach(() => {
      mockHttpService.post.mockReturnValue(of({ data: mockHtmlResponse }));
      mockMatchService.getMatches.mockResolvedValue([mockMatchEntry]);
      mockCacheService.getFromCacheOrGetAndCacheResult.mockImplementation(
        (_, fn) => fn(),
      );
    });

    it('should return head-to-head results for two players', async () => {
      const result = await service.getHead2HeadResults(123, 456);

      expect(result).toEqual(
        expect.objectContaining({
          head2HeadCount: 1,
          victoryCount: 1,
          defeatCount: 0,
          playersInfo: {
            playerUniqueIndex: 123,
            opponentPlayerUniqueIndex: 456,
            playerName: 'Player One',
            opponentPlayerName: 'Player Two',
          },
          matchEntryHistory: expect.arrayContaining([
            expect.objectContaining({
              season: 2023,
              playerRanking: 'C0',
              opponentRanking: 'C2',
              score: '3 - 1',
            }),
          ]),
        }),
      );
    });

    it('should use the same stable cache key for both player orders', async () => {
      await service.getHead2HeadResults(123, 456);
      await service.getHead2HeadResults(456, 123);

      expect(
        mockCacheService.getFromCacheOrGetAndCacheResult.mock.calls[0][0],
      ).toBe('head2head:123-456');
      expect(
        mockCacheService.getFromCacheOrGetAndCacheResult.mock.calls[1][0],
      ).toBe('head2head:123-456');
    });

    it('should reverse the cached canonical result for the opposite player order', async () => {
      const result = await service.getHead2HeadResults(456, 123);

      expect(result.playersInfo.playerUniqueIndex).toBe(456);
      expect(result.playersInfo.opponentPlayerUniqueIndex).toBe(123);
      expect(result.victoryCount).toBe(0);
      expect(result.defeatCount).toBe(1);
      expect(result.matchEntryHistory[0]).toEqual(
        expect.objectContaining({
          playerRanking: 'C2',
          opponentRanking: 'C0',
          score: '1 - 3',
        }),
      );
    });

    it('should apply a timeout in the HTTP request configuration', async () => {
      await service.getHead2HeadResults(123, 456);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        null,
        expect.objectContaining({ timeout: 5000, responseType: 'text' }),
      );
    });

    it('should return empty results when no matches are found', async () => {
      mockMatchService.getMatches.mockResolvedValue([]);

      const result = await service.getHead2HeadResults(123, 456);

      expect(result).toEqual(
        expect.objectContaining({
          head2HeadCount: 0,
          victoryCount: 0,
          defeatCount: 0,
          matchEntryHistory: [],
        }),
      );
    });

    it('should treat a not-found match detail as a legitimate absence', async () => {
      mockMatchService.getMatches.mockRejectedValue(new NotFoundException());

      await expect(service.getHead2HeadResults(123, 456)).resolves.toEqual(
        expect.objectContaining({ head2HeadCount: 0 }),
      );
    });

    it('should propagate a match dependency failure as 503 instead of caching an empty result', async () => {
      mockMatchService.getMatches.mockRejectedValue(new Error('SOAP down'));

      await expect(
        service.getHead2HeadResults(123, 456),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('should reject a partial result when any match detail dependency call fails', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: `${mockHtmlResponse}
            <a href="?season=2023&sel=1&detail=124&week_name=2&div_id=1">Match 02/24</a>`,
        }),
      );
      mockMatchService.getMatches
        .mockResolvedValueOnce([mockMatchEntry])
        .mockRejectedValueOnce(new Error('SOAP down'));

      await expect(
        service.getHead2HeadResults(123, 456),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('should clear the detail timeout after a successful request', async () => {
      jest.useFakeTimers();

      await service.getHead2HeadResults(123, 456);

      expect(jest.getTimerCount()).toBe(0);
      jest.useRealTimers();
    });

    it('should time out an individual match detail request', async () => {
      jest.useFakeTimers();
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'AFTT_MATCH_DETAILS_TIMEOUT_MS' ? 25 : undefined,
      );
      mockMatchService.getMatches.mockReturnValue(new Promise(() => undefined));

      const result = service.getHead2HeadResults(123, 456);
      const expectation = expect(result).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await jest.advanceTimersByTimeAsync(25);

      await expectation;
      expect(jest.getTimerCount()).toBe(0);
      jest.useRealTimers();
    });

    it('should throw error when AFTT page fetch fails', async () => {
      mockHttpService.post.mockImplementation(() => {
        throw new Error('Network error');
      });

      await expect(service.getHead2HeadResults(123, 456)).rejects.toThrow(
        'Failed to fetch data from AFTT',
      );
    });
  });
});
