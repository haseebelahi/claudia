import { KnowledgeEntry, KnowledgeEntryInsert, KnowledgeSearchResult } from '../models';
import { SupabaseService } from '../services';

export class KnowledgeRepository {
  constructor(private supabase: SupabaseService) {}

  async save(entry: KnowledgeEntryInsert): Promise<KnowledgeEntry> {
    return this.supabase.createKnowledgeEntry(entry);
  }

  async findById(_id: string): Promise<KnowledgeEntry | null> {
    // Implement if needed for Phase 2
    throw new Error('Not implemented yet');
  }

  async search(
    embedding: number[],
    threshold: number = 0.7,
    limit: number = 10,
    userId?: string
  ): Promise<KnowledgeSearchResult[]> {
    return this.supabase.searchKnowledge(embedding, threshold, limit, userId);
  }

  async findByConversationId(_conversationId: string): Promise<KnowledgeEntry[]> {
    // Implement if needed
    throw new Error('Not implemented yet');
  }

  async findByTags(_tags: string[]): Promise<KnowledgeEntry[]> {
    // Implement for Phase 2+
    throw new Error('Not implemented yet');
  }
}
