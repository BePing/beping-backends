import { Test, TestingModule } from '@nestjs/testing';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';
import { TestRequestService } from './test-request.service';
import { TestOutput } from '../../entity/tabt-soap/TabTAPI_Port';

describe('TestRequestService', () => {
  let provider: TestRequestService;
  let tabtService: TabtClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestRequestService,
        {
          provide: TabtClientService,
          useValue: {
            TestAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<TestRequestService>(TestRequestService);
    tabtService = module.get<TabtClientService>(TabtClientService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('testRequest', () => {
    it('should call the tabt service correctly and returns the test response', async () => {
      const testResponse: TestOutput = {
        Timestamp: '2021-01-12T14:24:27.000Z',
        ApiVersion: '0.7.25',
        IsValidAccount: false,
        Language: 'fr',
        Database: 'aftt',
        RequestorIp: '127.0.0.1',
        ConsumedTicks: 24,
        CurrentQuota: 0,
        AllowedQuota: 8000,
      };
      const spyOnTabt = jest
        .spyOn(tabtService, 'TestAsync')
        .mockResolvedValue([testResponse, '', {}, null, null]);

      const result = await provider.testRequest();

      expect(result).toBe(testResponse);
      expect(spyOnTabt).toHaveBeenCalledTimes(1);
      expect(spyOnTabt).toHaveBeenCalledWith({});
    });
  });
});
