import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { config } from '../config';
import {
  Conversation,
  ConversationInsert,
  ConversationUpdate,
  KnowledgeEntry,
  KnowledgeEntryInsert,
  KnowledgeSearchResult,
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

export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.supabase.url, config.supabase.key);
  }

  // Conversation methods
  async createConversation(data: ConversationInsert): Promise<Conversation> {
    const insertData: Record<string, unknown> = {
      raw_transcript: data.rawTranscript || '',
      status: data.status || 'active',
    };

    if (data.id) {
      insertData.id = data.id;
    }
    if (data.userId) {
      insertData.user_id = data.userId;
    }
    if (data.startedAt) {
      insertData.started_at = data.startedAt;
    }

    const { data: conversation, error } = await this.client
      .from('conversations')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Failed to create conversation:', error);
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return this.mapConversation(conversation);
  }

  async updateConversation(id: string, data: ConversationUpdate): Promise<Conversation> {
    const updateData: Record<string, unknown> = {};
    if (data.rawTranscript !== undefined) updateData.raw_transcript = data.rawTranscript;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.qualityRating !== undefined) updateData.quality_rating = data.qualityRating;

    const { data: conversation, error } = await this.client
      .from('conversations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Failed to update conversation ${id}:`, error);
      throw new Error(`Failed to update conversation: ${error.message}`);
    }

    return this.mapConversation(conversation);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error(`Failed to fetch conversation ${id}:`, error);
      throw new Error(`Failed to fetch conversation: ${error.message}`);
    }

    return this.mapConversation(data);
  }

  async getActiveConversationForUser(userId: string): Promise<Conversation | null> {
    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error(`Failed to fetch active conversation for user ${userId}:`, error);
      throw new Error(`Failed to fetch active conversation: ${error.message}`);
    }

    return this.mapConversation(data);
  }

  async getNonExtractedConversationsForUser(userId: string): Promise<Conversation[]> {
    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'extracted')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error(`Failed to fetch conversations for user ${userId}:`, error);
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }

    return data.map(this.mapConversation);
  }

  async deleteConversation(id: string): Promise<void> {
    const { error } = await this.client
      .from('conversations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Failed to delete conversation ${id}:`, error);
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }
  }

  // Knowledge entry methods
  async createKnowledgeEntry(data: KnowledgeEntryInsert): Promise<KnowledgeEntry> {
    const insertData: Record<string, unknown> = {
      type: data.type,
      problem: data.problem,
      context: data.context,
      solution: data.solution,
      learnings: data.learnings || [],
      tags: data.tags || [],
      embedding: data.embedding,
      decay_weight: data.decayWeight || 1.0,
    };

    // Optional fields
    if (data.conversationId) {
      insertData.conversation_id = data.conversationId;
    }
    if (data.userId) {
      insertData.user_id = data.userId;
    }

    const { data: entry, error } = await this.client
      .from('knowledge_entries')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Failed to create knowledge entry:', error);
      throw new Error(`Failed to create knowledge entry: ${error.message}`);
    }

    return this.mapKnowledgeEntry(entry);
  }

  async searchKnowledge(
    embedding: number[],
    threshold: number = 0.7,
    limit: number = 10,
    userId?: string
  ): Promise<KnowledgeSearchResult[]> {
    const rpcParams: Record<string, unknown> = {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    };

    // Add user filter if provided
    if (userId) {
      rpcParams.filter_user_id = userId;
    }

    const { data, error } = await this.client.rpc('match_knowledge', rpcParams);

    if (error) {
      console.error('Failed to search knowledge:', error);
      throw new Error(`Failed to search knowledge: ${error.message}`);
    }

    return data.map((item: any) => ({
      id: item.id,
      conversationId: item.conversation_id,
      userId: item.user_id,
      type: item.type,
      problem: item.problem,
      context: item.context,
      solution: item.solution,
      learnings: item.learnings,
      tags: item.tags,
      createdAt: new Date(item.created_at),
      decayWeight: item.decay_weight,
      similarity: item.similarity,
    }));
  }

  // Helper methods to map snake_case to camelCase
  private mapConversation(data: any): Conversation {
    return {
      id: data.id,
      userId: data.user_id,
      startedAt: new Date(data.started_at),
      rawTranscript: data.raw_transcript,
      status: data.status,
      qualityRating: data.quality_rating,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapKnowledgeEntry(data: any): KnowledgeEntry {
    return {
      id: data.id,
      conversationId: data.conversation_id,
      userId: data.user_id,
      type: data.type,
      problem: data.problem,
      context: data.context,
      solution: data.solution,
      learnings: data.learnings,
      tags: data.tags,
      embedding: data.embedding,
      createdAt: new Date(data.created_at),
      decayWeight: data.decay_weight,
    };
  }

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
