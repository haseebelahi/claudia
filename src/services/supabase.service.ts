import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { config } from '../config';
import {
  Conversation,
  ConversationInsert,
  ConversationUpdate,
  KnowledgeEntry,
  KnowledgeEntryInsert,
  KnowledgeSearchResult,
} from '../models';

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
    const { data: entry, error } = await this.client
      .from('knowledge_entries')
      .insert({
        conversation_id: data.conversationId,
        type: data.type,
        problem: data.problem,
        context: data.context,
        solution: data.solution,
        learnings: data.learnings || [],
        tags: data.tags || [],
        embedding: data.embedding,
        decay_weight: data.decayWeight || 1.0,
      })
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
    limit: number = 10
  ): Promise<KnowledgeSearchResult[]> {
    const { data, error } = await this.client.rpc('match_knowledge', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error('Failed to search knowledge:', error);
      throw new Error(`Failed to search knowledge: ${error.message}`);
    }

    return data.map((item: any) => ({
      id: item.id,
      conversationId: item.conversation_id,
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
}
