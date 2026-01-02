import { config } from '../config';
import { Conversation, ConversationState, Message } from '../models';

const SAVE_INTERVAL_MS = 300000; // 5 minutes
const SAVE_MESSAGE_THRESHOLD = 10; // 10 messages

export class ConversationStateService {
  private conversations: Map<string, ConversationState> = new Map();
  private loadedUsers: Set<string> = new Set();

  constructor() {}

  loadConversationFromDB(conversation: Conversation): void {
    const messages = this.parseTranscript(conversation.rawTranscript);

    const state: ConversationState = {
      conversationId: conversation.id,
      messages,
      lastActivity: conversation.updatedAt,
      isActive: conversation.status === 'active',
      lastSavedAt: conversation.updatedAt,
      messagesSinceLastSave: 0,
    };

    if (conversation.userId) {
      this.conversations.set(conversation.userId, state);
      this.loadedUsers.add(conversation.userId);
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
        lastSavedAt: null,
        messagesSinceLastSave: 0,
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
    state.messagesSinceLastSave++;

    // Trim conversation if too long
    if (state.messages.length > config.app.maxConversationLength) {
      state.messages = state.messages.slice(-config.app.maxConversationLength);
    }
  }

  shouldSaveConversation(userId: string): boolean {
    const state = this.conversations.get(userId);
    if (!state) return false;

    // Save if 10+ messages since last save
    if (state.messagesSinceLastSave >= SAVE_MESSAGE_THRESHOLD) {
      return true;
    }

    // Save if 5+ minutes since last save
    if (state.lastSavedAt) {
      const timeSinceLastSave = Date.now() - state.lastSavedAt.getTime();
      if (timeSinceLastSave >= SAVE_INTERVAL_MS) {
        return true;
      }
    } else {
      // Never saved before, should save
      return true;
    }

    return false;
  }

  markConversationSaved(userId: string): void {
    const state = this.conversations.get(userId);
    if (state) {
      state.lastSavedAt = new Date();
      state.messagesSinceLastSave = 0;
    }
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

    // Clean up after a grace period (1 hour)
    setTimeout(() => {
      this.conversations.delete(userId);
      this.loadedUsers.delete(userId);
      console.log(`Cleaned up conversation for user ${userId}`);
    }, 3600000);

    return state;
  }

  clearConversation(userId: string): void {
    this.conversations.delete(userId);
    this.loadedUsers.delete(userId);
  }
}
