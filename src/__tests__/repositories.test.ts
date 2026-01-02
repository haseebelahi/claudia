import { ConversationRepository } from '../repositories/conversation.repository';
import { KnowledgeRepository } from '../repositories/knowledge.repository';
import { SupabaseService } from '../services/supabase.service';
import { Conversation } from '../models';

// Mock the Supabase service
jest.mock('../services/supabase.service');

describe('Repository Pattern', () => {
  let mockSupabase: jest.Mocked<SupabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = new SupabaseService() as jest.Mocked<SupabaseService>;
  });

  describe('ConversationRepository', () => {
    let repository: ConversationRepository;

    beforeEach(() => {
      repository = new ConversationRepository(mockSupabase);
    });

    describe('create', () => {
      it('should delegate to supabase service', async () => {
        const mockConversation: Conversation = {
          id: 'conv1',
          userId: 'user1',
          startedAt: new Date(),
          rawTranscript: 'test',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockSupabase.createConversation = jest.fn().mockResolvedValue(mockConversation);

        const result = await repository.create({
          id: 'conv1',
          userId: 'user1',
          rawTranscript: 'test',
          status: 'active',
        });

        expect(result).toEqual(mockConversation);
        expect(mockSupabase.createConversation).toHaveBeenCalledWith({
          id: 'conv1',
          userId: 'user1',
          rawTranscript: 'test',
          status: 'active',
        });
      });
    });

    describe('update', () => {
      it('should delegate to supabase service', async () => {
        const mockConversation: Conversation = {
          id: 'conv1',
          userId: 'user1',
          startedAt: new Date(),
          rawTranscript: 'updated',
          status: 'extracted',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockSupabase.updateConversation = jest.fn().mockResolvedValue(mockConversation);

        const result = await repository.update('conv1', { status: 'extracted' });

        expect(result).toEqual(mockConversation);
        expect(mockSupabase.updateConversation).toHaveBeenCalledWith('conv1', {
          status: 'extracted',
        });
      });
    });

    describe('findById', () => {
      it('should delegate to supabase service', async () => {
        const mockConversation: Conversation = {
          id: 'conv1',
          userId: 'user1',
          startedAt: new Date(),
          rawTranscript: 'test',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockSupabase.getConversation = jest.fn().mockResolvedValue(mockConversation);

        const result = await repository.findById('conv1');

        expect(result).toEqual(mockConversation);
        expect(mockSupabase.getConversation).toHaveBeenCalledWith('conv1');
      });
    });

    describe('findActiveByUserId', () => {
      it('should delegate to supabase service', async () => {
        const mockConversation: Conversation = {
          id: 'conv1',
          userId: 'user1',
          startedAt: new Date(),
          rawTranscript: 'test',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockSupabase.getActiveConversationForUser = jest.fn().mockResolvedValue(mockConversation);

        const result = await repository.findActiveByUserId('user1');

        expect(result).toEqual(mockConversation);
        expect(mockSupabase.getActiveConversationForUser).toHaveBeenCalledWith('user1');
      });
    });

    describe('save', () => {
      it('should update if conversation exists', async () => {
        const existingConv: Conversation = {
          id: 'conv1',
          userId: 'user1',
          startedAt: new Date(),
          rawTranscript: 'old',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const updatedConv: Conversation = {
          ...existingConv,
          rawTranscript: 'updated',
        };

        mockSupabase.getConversation = jest.fn().mockResolvedValue(existingConv);
        mockSupabase.updateConversation = jest.fn().mockResolvedValue(updatedConv);

        const result = await repository.save({
          id: 'conv1',
          rawTranscript: 'updated',
        });

        expect(result).toEqual(updatedConv);
        expect(mockSupabase.getConversation).toHaveBeenCalledWith('conv1');
        expect(mockSupabase.updateConversation).toHaveBeenCalledWith('conv1', {
          id: 'conv1',
          rawTranscript: 'updated',
        });
      });

      it('should create if conversation does not exist', async () => {
        const newConv: Conversation = {
          id: 'conv2',
          userId: 'user2',
          startedAt: new Date(),
          rawTranscript: 'new',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockSupabase.getConversation = jest.fn().mockResolvedValue(null);
        mockSupabase.createConversation = jest.fn().mockResolvedValue(newConv);

        const result = await repository.save({
          id: 'conv2',
          userId: 'user2',
          rawTranscript: 'new',
          status: 'active',
        });

        expect(result).toEqual(newConv);
        expect(mockSupabase.getConversation).toHaveBeenCalledWith('conv2');
        expect(mockSupabase.createConversation).toHaveBeenCalledWith({
          id: 'conv2',
          userId: 'user2',
          rawTranscript: 'new',
          status: 'active',
        });
      });

      it('should create if no id provided', async () => {
        const newConv: Conversation = {
          id: 'generated-id',
          userId: 'user3',
          startedAt: new Date(),
          rawTranscript: 'new',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockSupabase.createConversation = jest.fn().mockResolvedValue(newConv);

        const result = await repository.save({
          userId: 'user3',
          rawTranscript: 'new',
          status: 'active',
        });

        expect(result).toEqual(newConv);
        expect(mockSupabase.createConversation).toHaveBeenCalled();
        expect(mockSupabase.getConversation).not.toHaveBeenCalled();
      });
    });

    describe('findNonExtractedByUserId', () => {
      it('should return all non-extracted conversations for user', async () => {
        const conversations: Conversation[] = [
          {
            id: 'conv1',
            userId: 'user1',
            startedAt: new Date(),
            rawTranscript: 'test1',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'conv2',
            userId: 'user1',
            startedAt: new Date(),
            rawTranscript: 'test2',
            status: 'archived',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        mockSupabase.getNonExtractedConversationsForUser = jest.fn().mockResolvedValue(conversations);

        const result = await repository.findNonExtractedByUserId('user1');

        expect(result).toEqual(conversations);
        expect(mockSupabase.getNonExtractedConversationsForUser).toHaveBeenCalledWith('user1');
      });

      it('should return empty array if no conversations found', async () => {
        mockSupabase.getNonExtractedConversationsForUser = jest.fn().mockResolvedValue([]);

        const result = await repository.findNonExtractedByUserId('user1');

        expect(result).toEqual([]);
      });
    });

    describe('delete', () => {
      it('should delete conversation by id', async () => {
        mockSupabase.deleteConversation = jest.fn().mockResolvedValue(undefined);

        await repository.delete('conv1');

        expect(mockSupabase.deleteConversation).toHaveBeenCalledWith('conv1');
      });
    });
  });

  describe('KnowledgeRepository', () => {
    let repository: KnowledgeRepository;

    beforeEach(() => {
      repository = new KnowledgeRepository(mockSupabase);
    });

    describe('save', () => {
      it('should delegate to supabase service', async () => {
        const mockEntry = {
          id: 'entry1',
          conversationId: 'conv1',
          type: 'problem_solution' as const,
          problem: 'test problem',
          context: 'test context',
          solution: 'test solution',
          learnings: ['learning1'],
          tags: ['tag1'],
          embedding: [0.1, 0.2, 0.3],
          createdAt: new Date(),
          decayWeight: 1.0,
        };

        mockSupabase.createKnowledgeEntry = jest.fn().mockResolvedValue(mockEntry);

        const result = await repository.save({
          conversationId: 'conv1',
          type: 'problem_solution',
          problem: 'test problem',
          context: 'test context',
          solution: 'test solution',
          learnings: ['learning1'],
          tags: ['tag1'],
          embedding: [0.1, 0.2, 0.3],
        });

        expect(result).toEqual(mockEntry);
        expect(mockSupabase.createKnowledgeEntry).toHaveBeenCalled();
      });
    });

    describe('search', () => {
      it('should delegate to supabase service with correct parameters', async () => {
        const mockResults = [
          {
            entry: {
              id: 'entry1',
              conversationId: 'conv1',
              type: 'problem_solution' as const,
              problem: 'test',
              context: 'test',
              solution: 'test',
              learnings: [],
              tags: [],
              embedding: [0.1],
              createdAt: new Date(),
              decayWeight: 1.0,
            },
            similarity: 0.95,
          },
        ];

        mockSupabase.searchKnowledge = jest.fn().mockResolvedValue(mockResults);

        const embedding = [0.1, 0.2, 0.3];
        const result = await repository.search(embedding, 0.8, 5);

        expect(result).toEqual(mockResults);
        expect(mockSupabase.searchKnowledge).toHaveBeenCalledWith(embedding, 0.8, 5);
      });

      it('should use default parameters', async () => {
        mockSupabase.searchKnowledge = jest.fn().mockResolvedValue([]);

        const embedding = [0.1, 0.2, 0.3];
        await repository.search(embedding);

        expect(mockSupabase.searchKnowledge).toHaveBeenCalledWith(embedding, 0.7, 10);
      });
    });

    describe('unimplemented methods', () => {
      it('findById should throw not implemented error', async () => {
        await expect(repository.findById('entry1')).rejects.toThrow('Not implemented yet');
      });

      it('findByConversationId should throw not implemented error', async () => {
        await expect(repository.findByConversationId('conv1')).rejects.toThrow(
          'Not implemented yet'
        );
      });

      it('findByTags should throw not implemented error', async () => {
        await expect(repository.findByTags(['tag1'])).rejects.toThrow('Not implemented yet');
      });
    });
  });
});
