import { OpenAIService } from '../services/openai.service';
import OpenAI from 'openai';

// Mock the OpenAI client
jest.mock('openai');

// Mock the config
jest.mock('../config', () => ({
  config: {
    openai: {
      apiKey: 'test-api-key',
    },
  },
}));

describe('OpenAIService - Retry Logic', () => {
  let service: OpenAIService;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock function
    mockCreate = jest.fn();
    
    // Create mock client
    const mockClient = {
      embeddings: {
        create: mockCreate,
      },
    } as any;

    // Mock the OpenAI constructor to return our mock client
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockClient);

    service = new OpenAIService();
  });

  describe('generateEmbedding', () => {
    it('should return embedding on first successful attempt', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: mockEmbedding, index: 0, object: 'embedding' }],
        model: 'text-embedding-3-small',
        object: 'list',
        usage: { prompt_tokens: 10, total_tokens: 10 },
      });

      const result = await service.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test text',
      });
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
      
      // First call fails, second succeeds
      mockCreate
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding, index: 0, object: 'embedding' }],
          model: 'text-embedding-3-small',
          object: 'list',
          usage: { prompt_tokens: 10, total_tokens: 10 },
        });

      const result = await service.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should retry on failure and succeed on third attempt', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
      
      // First two calls fail, third succeeds
      mockCreate
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding, index: 0, object: 'embedding' }],
          model: 'text-embedding-3-small',
          object: 'list',
          usage: { prompt_tokens: 10, total_tokens: 10 },
        });

      const result = await service.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      // All attempts fail
      mockCreate.mockRejectedValue(new Error('Persistent error'));

      await expect(service.generateEmbedding('test text')).rejects.toThrow(
        'Failed to generate embedding after 3 attempts'
      );

      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff delays', async () => {
      jest.useFakeTimers();
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
      
      // First two calls fail, third succeeds
      mockCreate
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding, index: 0, object: 'embedding' }],
          model: 'text-embedding-3-small',
          object: 'list',
          usage: { prompt_tokens: 10, total_tokens: 10 },
        });

      const promise = service.generateEmbedding('test text');

      // First attempt fails immediately
      await jest.advanceTimersByTimeAsync(0);
      
      // Wait 1000ms for first retry
      await jest.advanceTimersByTimeAsync(1000);
      
      // Wait 2000ms for second retry
      await jest.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    it('should handle non-Error exceptions', async () => {
      mockCreate.mockRejectedValue('String error');

      await expect(service.generateEmbedding('test text')).rejects.toThrow(
        'Failed to generate embedding after 3 attempts: Unknown error'
      );
    });
  });

  describe('generateEmbeddings (batch)', () => {
    it('should return multiple embeddings on success', async () => {
      const mockEmbeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
        [0.7, 0.8, 0.9],
      ];
      
      mockCreate.mockResolvedValueOnce({
        data: mockEmbeddings.map((embedding, index) => ({
          embedding,
          index,
          object: 'embedding' as const,
        })),
        model: 'text-embedding-3-small',
        object: 'list',
        usage: { prompt_tokens: 30, total_tokens: 30 },
      });

      const result = await service.generateEmbeddings(['text1', 'text2', 'text3']);

      expect(result).toEqual(mockEmbeddings);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['text1', 'text2', 'text3'],
      });
    });

    it('should retry batch generation on failure', async () => {
      const mockEmbeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ];
      
      mockCreate
        .mockRejectedValueOnce(new Error('Batch error'))
        .mockResolvedValueOnce({
          data: mockEmbeddings.map((embedding, index) => ({
            embedding,
            index,
            object: 'embedding' as const,
          })),
          model: 'text-embedding-3-small',
          object: 'list',
          usage: { prompt_tokens: 20, total_tokens: 20 },
        });

      const result = await service.generateEmbeddings(['text1', 'text2']);

      expect(result).toEqual(mockEmbeddings);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries for batch', async () => {
      mockCreate.mockRejectedValue(new Error('Persistent batch error'));

      await expect(service.generateEmbeddings(['text1', 'text2'])).rejects.toThrow(
        'Failed to generate embeddings after 3 attempts'
      );

      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });
});
