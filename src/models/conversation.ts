export type ConversationStatus = 'active' | 'extracted' | 'archived';

export interface Conversation {
  id: string;
  userId: string | null;
  startedAt: Date;
  rawTranscript: string;
  status: ConversationStatus;
  qualityRating?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationInsert {
  id?: string;
  userId?: string;
  startedAt?: Date;
  rawTranscript?: string;
  status?: ConversationStatus;
}

export interface ConversationUpdate {
  rawTranscript?: string;
  status?: ConversationStatus;
  qualityRating?: number;
}
