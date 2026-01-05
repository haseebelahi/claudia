import {
  Thought,
  ThoughtInsert,
  Source,
} from '../models';
import {
  SupabaseService,
  ThoughtSearchResult,
  HybridThoughtSearchResult,
} from '../services';

export interface ThoughtSearchOptions {
  queryText: string;
  queryEmbedding: number[];
  limit?: number;
  userId?: string;
  filterTags?: string[];
  filterKind?: string;
}

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
   * Hybrid search combining vector similarity and full-text search
   * Uses RRF (Reciprocal Rank Fusion) for better recall
   */
  async hybridSearch(options: ThoughtSearchOptions): Promise<HybridThoughtSearchResult[]> {
    return this.supabase.hybridSearchThoughts({
      queryEmbedding: options.queryEmbedding,
      queryText: options.queryText,
      limit: options.limit,
      userId: options.userId,
      filterTags: options.filterTags,
      filterKind: options.filterKind,
    });
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
