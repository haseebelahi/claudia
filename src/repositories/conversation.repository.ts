// DEPRECATED: This repository is obsolete after Phase 2.5 migration
// Conversations are now memory-only until extraction (stored as sources + thoughts)
// Keep this file for backwards compatibility but all methods are no-ops

import { Conversation, ConversationInsert, ConversationUpdate } from '../models';
import { SupabaseService } from '../services';

export class ConversationRepository {
  constructor(_supabase: SupabaseService) {}

  async create(_data: ConversationInsert): Promise<Conversation> {
    throw new Error('ConversationRepository.create: Legacy method removed. Conversations are memory-only.');
  }

  async update(_id: string, _data: ConversationUpdate): Promise<Conversation> {
    throw new Error('ConversationRepository.update: Legacy method removed. Conversations are memory-only.');
  }

  async findById(_id: string): Promise<Conversation | null> {
    // Return null - no persisted conversations
    return null;
  }

  async findActiveByUserId(_userId: string): Promise<Conversation | null> {
    // Return null - conversations are memory-only
    return null;
  }

  async save(_conversation: Partial<Conversation>): Promise<Conversation> {
    throw new Error('ConversationRepository.save: Legacy method removed. Conversations are memory-only.');
  }

  async findNonExtractedByUserId(_userId: string): Promise<Conversation[]> {
    // Return empty array - no persisted conversations
    return [];
  }

  async delete(_id: string): Promise<void> {
    // No-op - conversations are memory-only
    return;
  }
}
