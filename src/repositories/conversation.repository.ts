import { Conversation, ConversationInsert, ConversationUpdate } from '../models';
import { SupabaseService } from '../services';

export class ConversationRepository {
  constructor(private supabase: SupabaseService) {}

  async create(data: ConversationInsert): Promise<Conversation> {
    return this.supabase.createConversation(data);
  }

  async update(id: string, data: ConversationUpdate): Promise<Conversation> {
    return this.supabase.updateConversation(id, data);
  }

  async findById(id: string): Promise<Conversation | null> {
    return this.supabase.getConversation(id);
  }

  async findActiveByUserId(userId: string): Promise<Conversation | null> {
    return this.supabase.getActiveConversationForUser(userId);
  }

  async save(conversation: Partial<Conversation>): Promise<Conversation> {
    if (conversation.id) {
      // Check if exists
      const existing = await this.findById(conversation.id);
      if (existing) {
        return this.update(conversation.id, conversation);
      }
    }
    
    return this.create(conversation as ConversationInsert);
  }

  async findNonExtractedByUserId(userId: string): Promise<Conversation[]> {
    return this.supabase.getNonExtractedConversationsForUser(userId);
  }

  async delete(id: string): Promise<void> {
    return this.supabase.deleteConversation(id);
  }
}
