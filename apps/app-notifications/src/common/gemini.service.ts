import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenAI;
  private readonly model = 'gemini-1.5-flash';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      this.logger.log('GeminiService initialized');
    } else {
      this.logger.warn('GEMINI_API_KEY not found. AI features disabled.');
    }
  }

  async generateNotificationContent(
    context: string,
    locale: string = 'en',
  ): Promise<{ title: string; body: string } | null> {
    if (!this.genAI) {
      return null;
    }

    try {
      const prompt = `
        You are an expert copywriter for a table tennis mobile app.
        Generate a short, engaging notification title and body based on the following event context:
        "${context}"

        The content MUST be in the following language: "${locale}".

        The title should be catchy (max 30 chars).
        The body should be informative and exciting (max 100 chars).
        Return ONLY a JSON object with "title" and "body" keys. Do not use markdown code blocks.
      `;

      const response = await this.genAI.models.generateContent({
        model: this.model,
        contents: prompt,
      });
      const text = response.text;

      if (!text) {
        return null;
      }

      // Clean up potential markdown code blocks if the model ignores instructions
      const jsonString = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      return JSON.parse(jsonString);
    } catch (error) {
      this.logger.error('Failed to generate content with Gemini', error);
      return null;
    }
  }
}
