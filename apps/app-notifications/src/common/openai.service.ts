import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
      this.logger.log('OpenAIService initialized');
    } else {
      this.logger.warn('OPENAI_API_KEY not found. AI features disabled.');
    }
  }

  async generateNotificationContent(
    context: string,
    locale: string = 'en',
  ): Promise<{ title: string; body: string } | null> {
    if (!this.openai) {
      return null;
    }

    try {
      const prompt = `You are an expert copywriter for a table tennis mobile app.
Generate a short, engaging notification title and body based on the following event context:
"${context}"

The content MUST be in the following language: "${locale}".

The title should be catchy (max 30 chars).
The body should be informative and exciting (max 100 chars).
Return ONLY a JSON object with "title" and "body" keys. Do not use markdown code blocks.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert copywriter for a table tennis mobile app. Generate concise, engaging notification content.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        this.logger.warn('No content received from OpenAI');
        return null;
      }

      // Clean up potential markdown code blocks if the model ignores instructions
      const jsonString = content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      return JSON.parse(jsonString);
    } catch (error) {
      this.logger.error('Failed to generate content with OpenAI', error);
      return null;
    }
  }
}
