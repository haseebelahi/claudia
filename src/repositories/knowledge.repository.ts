// DEPRECATED: This repository is obsolete after Phase 2.5 migration
// Use ThoughtRepository instead for the new Thought Model v1
// Keep this file for backwards compatibility but all methods throw errors

import { KnowledgeEntry, KnowledgeEntryInsert, KnowledgeSearchResult } from '../models';
import { SupabaseService } from '../services';

export class KnowledgeRepository {
  constructor(_supabase: SupabaseService) {}

  async save(_entry: KnowledgeEntryInsert): Promise<KnowledgeEntry> {
    throw new Error('KnowledgeRepository.save: Legacy method removed. Use ThoughtRepository instead.');
  }

  async findById(_id: string): Promise<KnowledgeEntry | null> {
    throw new Error('KnowledgeRepository.findById: Legacy method removed. Use ThoughtRepository instead.');
  }

  async search(
    _embedding: number[],
    _threshold: number = 0.7,
    _limit: number = 10,
    _userId?: string
  ): Promise<KnowledgeSearchResult[]> {
    throw new Error('KnowledgeRepository.search: Legacy method removed. Use ThoughtRepository instead.');
  }

  async findByConversationId(_conversationId: string): Promise<KnowledgeEntry[]> {
    throw new Error('KnowledgeRepository.findByConversationId: Legacy method removed.');
  }

  async findByTags(_tags: string[]): Promise<KnowledgeEntry[]> {
    throw new Error('KnowledgeRepository.findByTags: Legacy method removed. Use ThoughtRepository instead.');
  }
}
