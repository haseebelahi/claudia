import { ConversationStateService } from '../services/conversation-state.service';
import { Conversation } from '../models';

// Mock the config module
jest.mock('../config', () => ({
  config: {
    app: {
      maxConversationLength: 200,
    },
  },
}));

describe('ConversationStateService - Smart Save Logic', () => {
  let service: ConversationStateService;

  beforeEach(() => {
    service = new ConversationStateService();
    jest.clearAllMocks();
  });

  describe('shouldSaveConversation', () => {
    it('should return true when conversation has never been saved', () => {
      const userId = 'user1';
      
      // Create a new conversation by adding a message
      service.addMessage(userId, {
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      });

      expect(service.shouldSaveConversation(userId)).toBe(true);
    });

    it('should return true after 10 messages since last save', () => {
      const userId = 'user2';
      
      // Add 5 messages and mark as saved
      for (let i = 0; i < 5; i++) {
        service.addMessage(userId, {
          role: 'user',
          content: `Message ${i}`,
          timestamp: new Date(),
        });
      }
      service.markConversationSaved(userId);

      // Add 10 more messages
      for (let i = 0; i < 10; i++) {
        service.addMessage(userId, {
          role: 'user',
          content: `New message ${i}`,
          timestamp: new Date(),
        });
      }

      expect(service.shouldSaveConversation(userId)).toBe(true);
    });

    it('should return false with fewer than 10 messages and less than 5 minutes', () => {
      const userId = 'user3';
      
      // Add 5 messages and mark as saved
      for (let i = 0; i < 5; i++) {
        service.addMessage(userId, {
          role: 'user',
          content: `Message ${i}`,
          timestamp: new Date(),
        });
      }
      service.markConversationSaved(userId);

      // Add only 5 more messages (less than 10)
      for (let i = 0; i < 5; i++) {
        service.addMessage(userId, {
          role: 'user',
          content: `New message ${i}`,
          timestamp: new Date(),
        });
      }

      expect(service.shouldSaveConversation(userId)).toBe(false);
    });

    it('should return true after 5 minutes even with few messages', () => {
      const userId = 'user4';
      
      // Add a message and mark as saved
      service.addMessage(userId, {
        role: 'user',
        content: 'Message 1',
        timestamp: new Date(),
      });
      service.markConversationSaved(userId);

      // Manually set lastSavedAt to 6 minutes ago
      const state = (service as any).conversations.get(userId);
      state.lastSavedAt = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago

      // Add just one more message
      service.addMessage(userId, {
        role: 'user',
        content: 'Message 2',
        timestamp: new Date(),
      });

      expect(service.shouldSaveConversation(userId)).toBe(true);
    });

    it('should return false for non-existent conversation', () => {
      expect(service.shouldSaveConversation('nonexistent')).toBe(false);
    });
  });

  describe('markConversationSaved', () => {
    it('should reset messagesSinceLastSave counter', () => {
      const userId = 'user5';
      
      // Add 5 messages
      for (let i = 0; i < 5; i++) {
        service.addMessage(userId, {
          role: 'user',
          content: `Message ${i}`,
          timestamp: new Date(),
        });
      }

      // Mark as saved
      service.markConversationSaved(userId);

      const state = (service as any).conversations.get(userId);
      expect(state.messagesSinceLastSave).toBe(0);
      expect(state.lastSavedAt).toBeInstanceOf(Date);
    });

    it('should not throw error for non-existent conversation', () => {
      expect(() => service.markConversationSaved('nonexistent')).not.toThrow();
    });
  });

  describe('loadConversationFromDB', () => {
    it('should initialize conversation with correct persistence tracking', () => {
      const conversation: Conversation = {
        id: 'conv1',
        userId: 'user6',
        startedAt: new Date(),
        rawTranscript: 'user: Hello\n\nassistant: Hi there',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.loadConversationFromDB(conversation);

      const state = (service as any).conversations.get('user6');
      expect(state.lastSavedAt).toEqual(conversation.updatedAt);
      expect(state.messagesSinceLastSave).toBe(0);
      expect(state.messages).toHaveLength(2);
    });
  });

  describe('endConversation - Memory Cleanup', () => {
    it('should mark conversation as inactive', () => {
      const userId = 'user7';
      
      service.addMessage(userId, {
        role: 'user',
        content: 'Test',
        timestamp: new Date(),
      });

      service.endConversation(userId);

      expect(service.isConversationActive(userId)).toBe(false);
    });

    it('should schedule cleanup for later', (done) => {
      const userId = 'user8';
      
      service.addMessage(userId, {
        role: 'user',
        content: 'Test',
        timestamp: new Date(),
      });

      service.endConversation(userId);

      // Conversation should still exist immediately after ending
      const conversations = (service as any).conversations;
      const hasConversation = conversations.has(userId);
      expect(hasConversation).toBe(true);

      // Note: Full cleanup test would require mocking setTimeout
      // or waiting 1 hour which is impractical for unit tests
      done();
    });

    it('should return null for non-existent conversation', () => {
      const result = service.endConversation('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('addMessage - No Timeout Logic', () => {
    it('should add message without resetting any timeout', () => {
      const userId = 'user9';
      
      service.addMessage(userId, {
        role: 'user',
        content: 'Message 1',
        timestamp: new Date(),
      });

      // Verify no timeout property exists
      expect((service as any).timeouts).toBeUndefined();
    });

    it('should increment messagesSinceLastSave', () => {
      const userId = 'user10';
      
      service.addMessage(userId, {
        role: 'user',
        content: 'Message 1',
        timestamp: new Date(),
      });

      service.addMessage(userId, {
        role: 'assistant',
        content: 'Response 1',
        timestamp: new Date(),
      });

      const state = (service as any).conversations.get(userId);
      expect(state.messagesSinceLastSave).toBe(2);
    });
  });

  describe('Conversation length limit', () => {
    it('should trim messages when exceeding max length', () => {
      const userId = 'user11';
      
      // Add 205 messages (more than the 200 limit)
      for (let i = 0; i < 205; i++) {
        service.addMessage(userId, {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: new Date(),
        });
      }

      const messages = service.getMessages(userId);
      expect(messages).toHaveLength(200);
      
      // Should keep the most recent messages
      expect(messages[messages.length - 1].content).toBe('Message 204');
    });
  });
});
