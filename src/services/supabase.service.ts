import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { config } from '../config';
import {
  // Thought Model v1
  Source,
  SourceInsert,
  Thought,
  ThoughtInsert,
} from '../models';

// Search result with similarity score
export interface ThoughtSearchResult extends Thought {
  similarity: number;
}

// Hybrid search result with both vector and text scores
export interface HybridThoughtSearchResult extends ThoughtSearchResult {
  textRank: number;
  hybridScore: number;
}

// Options for hybrid search
export interface HybridSearchOptions {
  queryEmbedding: number[];
  queryText: string;
  limit?: number;
  userId?: string;
  filterTags?: string[];
  filterKind?: string;
}

export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.supabase.url, config.supabase.key);
  }

  // NOTE: Legacy conversation and knowledge_entries methods removed
  // Conversations are now memory-only until extraction
  // Use thoughts + sources tables instead

  // ===========================================================================
  // THOUGHT MODEL v1 METHODS
  // ===========================================================================

  // Source methods
  async createSource(data: SourceInsert): Promise<Source> {
    const insertData: Record<string, unknown> = {
      user_id: data.userId,
      type: data.type,
      raw: data.raw,
    };

    if (data.title) insertData.title = data.title;
    if (data.summary) insertData.summary = data.summary;
    if (data.url) insertData.url = data.url;
    if (data.metadata) insertData.metadata = data.metadata;

    const { data: source, error } = await this.client
      .from('sources')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Failed to create source:', error);
      throw new Error(`Failed to create source: ${error.message}`);
    }

    return this.mapSource(source);
  }

  async getSource(id: string): Promise<Source | null> {
    const { data, error } = await this.client
      .from('sources')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch source: ${error.message}`);
    }

    return this.mapSource(data);
  }

  // Thought methods
  async createThought(data: ThoughtInsert): Promise<Thought> {
    const insertData: Record<string, unknown> = {
      user_id: data.userId,
      kind: data.kind,
      domain: data.domain,
      claim: data.claim,
      stance: data.stance,
      confidence: data.confidence,
      privacy: data.privacy || 'private',
      tags: data.tags || [],
    };

    // Optional fields
    if (data.context) insertData.context = data.context;
    if (data.evidence) insertData.evidence = data.evidence;
    if (data.examples) insertData.examples = data.examples;
    if (data.actionables) insertData.actionables = data.actionables;
    if (data.supersedes_id) insertData.supersedes_id = data.supersedes_id;
    if (data.related_ids) insertData.related_ids = data.related_ids;
    if (data.embedding) insertData.embedding = data.embedding;

    const { data: thought, error } = await this.client
      .from('thoughts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Failed to create thought:', error);
      throw new Error(`Failed to create thought: ${error.message}`);
    }

    // If this supersedes another thought, update the old one
    if (data.supersedes_id) {
      await this.client
        .from('thoughts')
        .update({ superseded_by_id: thought.id })
        .eq('id', data.supersedes_id);
    }

    return this.mapThought(thought);
  }

  async getThought(id: string): Promise<Thought | null> {
    const { data, error } = await this.client
      .from('thoughts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch thought: ${error.message}`);
    }

    return this.mapThought(data);
  }

  async searchThoughts(
    embedding: number[],
    threshold: number = 0.5,
    limit: number = 10,
    userId?: string
  ): Promise<ThoughtSearchResult[]> {
    const rpcParams: Record<string, unknown> = {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    };

    if (userId) {
      rpcParams.filter_user_id = userId;
    }

    const { data, error } = await this.client.rpc('match_thoughts', rpcParams);

    if (error) {
      console.error('Failed to search thoughts:', error);
      throw new Error(`Failed to search thoughts: ${error.message}`);
    }

    return data.map((item: any) => ({
      id: item.id,
      userId: item.user_id,
      kind: item.kind,
      domain: item.domain,
      privacy: 'private' as const, // Not returned by search function
      claim: item.claim,
      stance: item.stance,
      confidence: item.confidence,
      context: item.context,
      evidence: item.evidence || [],
      actionables: item.actionables || [],
      tags: item.tags || [],
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.created_at), // Approximation
      similarity: item.similarity,
    }));
  }

  /**
   * Hybrid search combining vector similarity and full-text search
   * Uses RRF (Reciprocal Rank Fusion) to merge rankings
   */
  async hybridSearchThoughts(options: HybridSearchOptions): Promise<HybridThoughtSearchResult[]> {
    const {
      queryEmbedding,
      queryText,
      limit = 10,
      userId,
      filterTags,
      filterKind,
    } = options;

    const rpcParams: Record<string, unknown> = {
      query_embedding: queryEmbedding,
      query_text: queryText,
      match_count: limit,
    };

    if (userId) {
      rpcParams.filter_user_id = userId;
    }
    if (filterTags && filterTags.length > 0) {
      rpcParams.filter_tags = filterTags;
    }
    if (filterKind) {
      rpcParams.filter_kind = filterKind;
    }

    const { data, error } = await this.client.rpc('hybrid_match_thoughts', rpcParams);

    if (error) {
      console.error('Failed to hybrid search thoughts:', error);
      throw new Error(`Failed to hybrid search thoughts: ${error.message}`);
    }

    return data.map((item: any) => ({
      id: item.id,
      userId: item.user_id,
      kind: item.kind,
      domain: item.domain,
      privacy: 'private' as const,
      claim: item.claim,
      stance: item.stance,
      confidence: item.confidence,
      context: item.context,
      evidence: item.evidence || [],
      examples: [],
      actionables: item.actionables || [],
      tags: item.tags || [],
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.created_at),
      similarity: item.similarity,
      textRank: item.text_rank,
      hybridScore: item.hybrid_score,
    }));
  }

  // Thought-source linking
  async linkThoughtToSource(thoughtId: string, sourceId: string, quoted?: string): Promise<void> {
    const insertData: Record<string, unknown> = {
      thought_id: thoughtId,
      source_id: sourceId,
    };
    if (quoted) insertData.quoted = quoted;

    const { error } = await this.client
      .from('thought_sources')
      .insert(insertData);

    if (error) {
      console.error('Failed to link thought to source:', error);
      throw new Error(`Failed to link thought to source: ${error.message}`);
    }
  }

  async getThoughtSources(thoughtId: string): Promise<Source[]> {
    const { data, error } = await this.client
      .from('thought_sources')
      .select('source_id, sources(*)')
      .eq('thought_id', thoughtId);

    if (error) {
      throw new Error(`Failed to fetch thought sources: ${error.message}`);
    }

    return data.map((item: any) => this.mapSource(item.sources));
  }

  /**
   * Get sources for a user, optionally filtered by type
   * Returns most recent first
   */
  async getSourcesByUser(
    userId: string,
    type?: string,
    limit: number = 10
  ): Promise<Source[]> {
    let query = this.client
      .from('sources')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch sources:', error);
      throw new Error(`Failed to fetch sources: ${error.message}`);
    }

    return data.map((item: any) => this.mapSource(item));
  }

  // Mappers for new types
  private mapSource(data: any): Source {
    return {
      id: data.id,
      userId: data.user_id,
      type: data.type,
      title: data.title,
      raw: data.raw,
      summary: data.summary,
      url: data.url,
      metadata: data.metadata,
      capturedAt: new Date(data.captured_at),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapThought(data: any): Thought {
    return {
      id: data.id,
      userId: data.user_id,
      kind: data.kind,
      domain: data.domain,
      privacy: data.privacy,
      claim: data.claim,
      stance: data.stance,
      confidence: data.confidence,
      context: data.context,
      evidence: data.evidence || [],
      examples: data.examples || [],
      actionables: data.actionables || [],
      tags: data.tags || [],
      supersedes_id: data.supersedes_id,
      superseded_by_id: data.superseded_by_id,
      related_ids: data.related_ids || [],
      embedding: data.embedding,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
