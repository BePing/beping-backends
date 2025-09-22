import { Test, TestingModule } from '@nestjs/testing';
import { BepingNotifierService } from './beping-notifier.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { NotificationAcknolwedgement } from './models/notification-ack.model';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';

describe('BepingNotifierService', () => {
  let service: BepingNotifierService;
  let configService: jest.Mocked<ConfigService>;
  let httpService: jest.Mocked<HttpService>;

  const mockConfig = {
    BEPING_NOTIFICATION_URL: 'http://test-api.com/',
    BEPING_NOTIFICATION_CONSUMER_KEY: 'test-key',
    BEPING_NOTIFICATION_CONSUMER_SECRET: 'test-secret',
    NODE_ENV: 'test',
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => mockConfig[key]),
    } as any;

    httpService = {
      post: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BepingNotifierService,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: HttpService,
          useValue: httpService,
        },
      ],
    }).compile();

    service = module.get<BepingNotifierService>(BepingNotifierService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should throw error if notification URL is not configured in production', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'NODE_ENV' ? 'production' : undefined,
      );

      expect(() => {
        new BepingNotifierService(httpService, configService);
      }).toThrow('BEPING_NOTIFICATION_URL is not configured');
    });

    it('should not throw error if notification URL is missing in dev mode', () => {
      configService.get.mockImplementation((key: string) =>
        key === 'NODE_ENV' ? 'dev' : undefined,
      );

      expect(() => {
        new BepingNotifierService(httpService, configService);
      }).not.toThrow();
    });
  });

  describe('notifyNumericRankingChanged', () => {
    const validPayload = {
      uniqueIndex: 123,
      oldRanking: 100,
      newRanking: 150,
    };

    const mockResponse: AxiosResponse<NotificationAcknolwedgement> = {
      data: { sent: true, acknolwedgedId: 'test-ack-id' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully send notification for valid ranking update', async () => {
      httpService.post.mockReturnValue(of(mockResponse));

      const result = await service.notifyNumericRankingChanged(
        validPayload.uniqueIndex,
        validPayload.oldRanking,
        validPayload.newRanking,
      );

      expect(result).toEqual(mockResponse.data);
      expect(httpService.post).toHaveBeenCalledWith(
        'http://test-api.com/numeric-ranking/update',
        validPayload,
        expect.objectContaining({
          auth: {
            username: 'test-key',
            password: 'test-secret',
          },
        }),
      );
    });

    it('should return null for unchanged ranking', async () => {
      const result = await service.notifyNumericRankingChanged(123, 100, 100);
      expect(result).toBeNull();
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should return null for invalid ranking parameters', async () => {
      const testCases = [
        [0, 100, 150],
        [123, 0, 150],
        [123, 100, 0],
      ];

      for (const [uniqueIndex, oldRanking, newRanking] of testCases) {
        const result = await service.notifyNumericRankingChanged(
          uniqueIndex,
          oldRanking,
          newRanking,
        );
        expect(result).toBeNull();
        expect(httpService.post).not.toHaveBeenCalled();
      }
    });

    it('should handle HTTP errors gracefully', async () => {
      const axiosError = new AxiosError(
        'Network Error',
        'NETWORK_ERROR',
        {} as any,
        {},
        {
          status: 500,
          data: 'Internal Server Error',
        } as any,
      );

      httpService.post.mockReturnValue(throwError(() => axiosError));

      const result = await service.notifyNumericRankingChanged(
        validPayload.uniqueIndex,
        validPayload.oldRanking,
        validPayload.newRanking,
      );

      expect(result).toEqual({ sent: false });
    });

    it('should skip notification in dev mode', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'NODE_ENV' ? 'dev' : mockConfig[key],
      );

      const result = await service.notifyNumericRankingChanged(
        validPayload.uniqueIndex,
        validPayload.oldRanking,
        validPayload.newRanking,
      );

      expect(result).toBeNull();
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should throw error if auth credentials are missing', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'BEPING_NOTIFICATION_URL') return 'http://test-api.com/';
        return undefined;
      });

      await expect(
        service.notifyNumericRankingChanged(
          validPayload.uniqueIndex,
          validPayload.oldRanking,
          validPayload.newRanking,
        ),
      ).rejects.toThrow('Notification credentials are not properly configured');
    });
  });
});
