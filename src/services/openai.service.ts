import OpenAI from 'openai';

import { config } from '../config';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('OpenAI API error:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to generate embedding: ${error.message}`);
      }
      throw error;
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      });

      return response.data.map((item) => item.embedding);
    } catch (error) {
      console.error('OpenAI API error:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to generate embeddings: ${error.message}`);
      }
      throw error;
    }
  }
}
