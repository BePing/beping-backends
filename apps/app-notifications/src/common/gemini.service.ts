import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
    private readonly logger = new Logger(GeminiService.name);
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            this.logger.log('GeminiService initialized');
        } else {
            this.logger.warn('GEMINI_API_KEY not found. AI features disabled.');
        }
    }

    async generateNotificationContent(
        context: string,
        locale: string = 'en',
    ): Promise<{ title: string; body: string } | null> {
        if (!this.model) {
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

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean up potential markdown code blocks if the model ignores instructions
            const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

            return JSON.parse(jsonString);
        } catch (error) {
            this.logger.error('Failed to generate content with Gemini', error);
            return null;
        }
    }
}
