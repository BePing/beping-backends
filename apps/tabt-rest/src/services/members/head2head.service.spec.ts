import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';

import { Head2headService } from './head2head.service';
import { MatchService } from '../matches/match.service';
import { CacheService } from '@app/common';
import { SocksProxyHttpClient } from '../../common/socks-proxy/socks-proxy-http-client';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Head2headService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: MatchService, useValue: mockMatchService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: SocksProxyHttpClient, useValue: mockSocksProxyService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
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
