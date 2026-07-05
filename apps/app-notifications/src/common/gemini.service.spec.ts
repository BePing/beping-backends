import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from './gemini.service';

const generateContentMock = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: generateContentMock,
    },
  })),
}));

const buildService = async (apiKey?: string): Promise<GeminiService> => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      GeminiService,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn().mockReturnValue(apiKey),
        },
      },
    ],
  }).compile();

  return module.get<GeminiService>(GeminiService);
};

describe('GeminiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', async () => {
    const service = await buildService('test-api-key');
    expect(service).toBeDefined();
  });

  it('returns null when GEMINI_API_KEY is not configured', async () => {
    const service = await buildService(undefined);

    const result = await service.generateNotificationContent('some context');

    expect(result).toBeNull();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('generates notification content on the happy path', async () => {
    generateContentMock.mockResolvedValue({
      text: '{"title":"Hello","body":"World"}',
    });
    const service = await buildService('test-api-key');

    const result = await service.generateNotificationContent(
      'a table tennis match starts soon',
      'fr',
    );

    expect(result).toEqual({ title: 'Hello', body: 'World' });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const callArg = generateContentMock.mock.calls[0][0];
    expect(callArg.model).toBe('gemini-1.5-flash');
    expect(callArg.contents).toContain('a table tennis match starts soon');
    expect(callArg.contents).toContain('"fr"');
  });

  it('strips markdown code fences from the model response', async () => {
    generateContentMock.mockResolvedValue({
      text: '```json\n{"title":"Hi","body":"There"}\n```',
    });
    const service = await buildService('test-api-key');

    const result = await service.generateNotificationContent('context');

    expect(result).toEqual({ title: 'Hi', body: 'There' });
  });

  it('returns null when the model returns no text', async () => {
    generateContentMock.mockResolvedValue({ text: undefined });
    const service = await buildService('test-api-key');

    const result = await service.generateNotificationContent('context');

    expect(result).toBeNull();
  });

  it('returns null when generateContent throws', async () => {
    generateContentMock.mockRejectedValue(new Error('boom'));
    const service = await buildService('test-api-key');

    const result = await service.generateNotificationContent('context');

    expect(result).toBeNull();
  });
});
