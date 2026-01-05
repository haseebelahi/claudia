import {
  Thought,
  ThoughtInsert,
  Source,
  SourceInsert,
} from '../models';
import { SupabaseService, ThoughtSearchResult } from '../services';

export class ThoughtRepository {
  constructor(private supabase: SupabaseService) {}

  /**
   * Save a thought to the database
   */
  async save(thought: ThoughtInsert): Promise<Thought> {
    return this.supabase.createThought(thought);
  }

  /**
   * Save multiple thoughts (from extraction)
   */
  async saveMany(thoughts: ThoughtInsert[]): Promise<Thought[]> {
    const saved: Thought[] = [];
    for (const thought of thoughts) {
      saved.push(await this.save(thought));
    }
    return saved;
  }

  /**
   * Find a thought by ID
   */
  async findById(id: string): Promise<Thought | null> {
    return this.supabase.getThought(id);
  }

  /**
   * Search thoughts by semantic similarity
   */
  async search(
    embedding: number[],
    threshold: number = 0.5,
    limit: number = 10,
    userId?: string
  ): Promise<ThoughtSearchResult[]> {
    return this.supabase.searchThoughts(embedding, threshold, limit, userId);
  }

  /**
   * Link a thought to its source
   */
  async linkToSource(thoughtId: string, sourceId: string, quoted?: string): Promise<void> {
    return this.supabase.linkThoughtToSource(thoughtId, sourceId, quoted);
  }

  /**
   * Get all sources for a thought
   */
  async getSources(thoughtId: string): Promise<Source[]> {
    return this.supabase.getThoughtSources(thoughtId);
  }
}

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
