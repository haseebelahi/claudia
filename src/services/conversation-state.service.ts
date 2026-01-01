import { config } from '../config';
import { Conversation, ConversationState, Message } from '../models';

export class ConversationStateService {
  private conversations: Map<string, ConversationState> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private loadedUsers: Set<string> = new Set();

  constructor() {}

  loadConversationFromDB(conversation: Conversation): void {
    const messages = this.parseTranscript(conversation.rawTranscript);

    const state: ConversationState = {
      conversationId: conversation.id,
      messages,
      lastActivity: conversation.updatedAt,
      isActive: conversation.status === 'active',
    };

    if (conversation.userId) {
      this.conversations.set(conversation.userId, state);
      this.loadedUsers.add(conversation.userId);
      
      // Restart timeout if conversation is active
      if (state.isActive && state.messages.length > 0) {
        this.resetTimeout(conversation.userId);
      }
    }
  }

  hasLoadedUser(userId: string): boolean {
    return this.loadedUsers.has(userId);
  }

  markUserAsLoaded(userId: string): void {
    this.loadedUsers.add(userId);
  }

  getOrCreateConversation(userId: string): ConversationState {
    let state = this.conversations.get(userId);
    
    if (!state) {
      // Create new conversation
      state = {
        conversationId: crypto.randomUUID(),
        messages: [],
        lastActivity: new Date(),
        isActive: true,
      };
      this.conversations.set(userId, state);
    }

    return state;
  }

  private parseTranscript(transcript: string): Message[] {
    if (!transcript) {
      return [];
    }

    const messages: Message[] = [];
    const lines = transcript.split('\n\n');

    for (const line of lines) {
      const match = line.match(/^(user|assistant): (.+)$/s);
      if (match) {
        messages.push({
          role: match[1] as 'user' | 'assistant',
          content: match[2],
          timestamp: new Date(),
        });
      }
    }

    return messages;
  }

  addMessage(userId: string, message: Message): void {
    const state = this.getOrCreateConversation(userId);
    state.messages.push(message);
    state.lastActivity = new Date();

    // Trim conversation if too long
    if (state.messages.length > config.app.maxConversationLength) {
      state.messages = state.messages.slice(-config.app.maxConversationLength);
    }

    // Reset inactivity timeout
    this.resetTimeout(userId);
  }

  getMessages(userId: string): Message[] {
    const state = this.conversations.get(userId);
    return state?.messages || [];
  }

  getConversationId(userId: string): string | null {
    const state = this.conversations.get(userId);
    return state?.conversationId || null;
  }

  isConversationActive(userId: string): boolean {
    const state = this.conversations.get(userId);
    return state?.isActive || false;
  }

  endConversation(userId: string): ConversationState | null {
    const state = this.conversations.get(userId);
    if (!state) {
      return null;
    }

    state.isActive = false;
    this.clearTimeout(userId);

    // Keep the conversation in memory for a short while for extraction
    // It will be cleaned up on next conversation start
    return state;
  }

  clearConversation(userId: string): void {
    this.conversations.delete(userId);
    this.clearTimeout(userId);
  }

  private resetTimeout(userId: string): void {
    this.clearTimeout(userId);

    const timeout = setTimeout(() => {
      console.log(`Conversation timeout for user ${userId}`);
      this.endConversation(userId);
    }, config.app.conversationTimeoutMs);

    this.timeouts.set(userId, timeout);
  }

  private clearTimeout(userId: string): void {
    const timeout = this.timeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(userId);
    }
  }
}
