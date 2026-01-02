export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ConversationState {
  conversationId: string;
  messages: Message[];
  lastActivity: Date;
  isActive: boolean;
  lastSavedAt: Date | null;
  messagesSinceLastSave: number;
}
