import OpenAI from 'openai';

import { config } from '../config';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateEmbedding(text: string, maxRetries: number = 3): Promise<number[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.client.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
        });

        return response.data[0].embedding;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on the last attempt
        if (attempt === maxRetries - 1) {
          break;
        }

        // Calculate backoff delay: 1s, 2s, 4s
        const delayMs = 1000 * Math.pow(2, attempt);
        
        console.warn(
          `OpenAI embedding attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}. ` +
          `Retrying in ${delayMs}ms...`
        );
        
        await this.sleep(delayMs);
      }
    }

    // All retries failed
    console.error(`OpenAI API error after ${maxRetries} attempts:`, lastError);
    throw new Error(`Failed to generate embedding after ${maxRetries} attempts: ${lastError?.message}`);
  }

  async generateEmbeddings(texts: string[], maxRetries: number = 3): Promise<number[][]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.client.embeddings.create({
          model: 'text-embedding-3-small',
          input: texts,
        });

        return response.data.map((item) => item.embedding);
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries - 1) {
          break;
        }

        const delayMs = 1000 * Math.pow(2, attempt);
        
        console.warn(
          `OpenAI embeddings (batch) attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}. ` +
          `Retrying in ${delayMs}ms...`
        );
        
        await this.sleep(delayMs);
      }
    }

    console.error(`OpenAI API error after ${maxRetries} attempts:`, lastError);
    throw new Error(`Failed to generate embeddings after ${maxRetries} attempts: ${lastError?.message}`);
  }
}
