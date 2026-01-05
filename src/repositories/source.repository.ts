import { Source, SourceInsert } from '../models';
import { SupabaseService } from '../services';

export class SourceRepository {
  constructor(private supabase: SupabaseService) {}

  /**
   * Save a source (conversation, article, etc.)
   */
  async save(source: SourceInsert): Promise<Source> {
    return this.supabase.createSource(source);
  }

  /**
   * Find a source by ID
   */
  async findById(id: string): Promise<Source | null> {
    return this.supabase.getSource(id);
  }

  /**
   * Find sources for a user, optionally filtered by type
   * Returns most recent first
   */
  async findByUser(
    userId: string,
    type?: string,
    limit: number = 10
  ): Promise<Source[]> {
    return this.supabase.getSourcesByUser(userId, type, limit);
  }

  /**
   * Find sources for a user with thought counts
   * Returns most recent first
   */
  async findByUserWithThoughtCount(
    userId: string,
    type?: string,
    limit: number = 10
  ): Promise<Array<Source & { thoughtCount: number }>> {
    return this.supabase.getSourcesWithThoughtCount(userId, type, limit);
  }

  /**
   * Create a conversation source from a transcript
   */
  async createFromConversation(
    userId: string,
    transcript: string,
    title?: string
  ): Promise<Source> {
    return this.save({
      userId,
      type: 'conversation',
      title: title || `Conversation ${new Date().toISOString().split('T')[0]}`,
      raw: transcript,
    });
  }
}
