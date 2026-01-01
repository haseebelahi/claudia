import { Context, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { config } from '../config';
import {
  ConversationStateService,
  LLMService,
  OpenAIService,
  SupabaseService,
} from '../services';

export class TelegramHandler {
  private bot: Telegraf;
  private conversationState: ConversationStateService;
  private llm: LLMService;
  private openai: OpenAIService;
  private supabase: SupabaseService;

  constructor() {
    this.bot = new Telegraf(config.telegram.botToken);
    this.conversationState = new ConversationStateService();
    this.llm = new LLMService();
    this.openai = new OpenAIService();
    this.supabase = new SupabaseService();

    this.setupHandlers();
  }

  async initialize(): Promise<void> {
    console.log('Bot initialized. Conversations will be loaded on-demand when users message.');
  }

  private async loadUserConversation(userId: string): Promise<void> {
    try {
      const conversation = await this.supabase.getActiveConversationForUser(userId);
      
      if (conversation) {
        console.log(`Loading active conversation for user ${userId}: ${conversation.id}`);
        this.conversationState.loadConversationFromDB(conversation);
      }
    } catch (error) {
      console.error(`Failed to load conversation for user ${userId}:`, error);
      // Continue anyway - will create new conversation
    }
  }

  private setupHandlers(): void {
    // Status command
    this.bot.command('status', async (ctx) => {
      await this.handleStatus(ctx);
    });

    // Extract command - manually trigger extraction
    this.bot.command('extract', async (ctx) => {
      await this.handleExtract(ctx);
    });

    // New conversation command
    this.bot.command('new', async (ctx) => {
      await this.handleNewConversation(ctx);
    });

    // Clear command - clear current conversation without saving
    this.bot.command('clear', async (ctx) => {
      await this.handleClear(ctx);
    });

    // Handle all text messages
    this.bot.on(message('text'), async (ctx) => {
      await this.handleMessage(ctx);
    });

    // Error handling
    this.bot.catch((err, ctx) => {
      console.error(`Error for ${ctx.updateType}:`, err);
      ctx.reply('Sorry, something went wrong. Please try again.');
    });
  }

  private async handleStatus(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    const isActive = this.conversationState.isConversationActive(userId);
    const messages = this.conversationState.getMessages(userId);
    const conversationId = this.conversationState.getConversationId(userId);

    const status = [
      '📊 *Status*',
      '',
      `Conversation: ${isActive ? '🟢 Active' : '⚫ Inactive'}`,
      `Messages: ${messages.length}`,
      `ID: ${conversationId || 'None'}`,
    ].join('\n');

    await ctx.reply(status, { parse_mode: 'Markdown' });
  }

  private async handleExtract(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    const messages = this.conversationState.getMessages(userId);
    if (messages.length === 0) {
      await ctx.reply('No conversation to extract.');
      return;
    }

    await ctx.reply('Extracting knowledge from our conversation...');

    try {
      await this.extractAndSave(userId);
      await ctx.reply('✅ Knowledge extracted and saved!');
    } catch (error) {
      console.error('Failed to extract knowledge:', error);
      await ctx.reply('Failed to extract knowledge. Please try again.');
    }
  }

  private async handleNewConversation(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    const messages = this.conversationState.getMessages(userId);
    if (messages.length > 0) {
      await ctx.reply(
        'You have an active conversation with ' + messages.length + ' messages.\n\n' +
        'What would you like to do?\n' +
        '• /extract - Save this conversation as knowledge\n' +
        '• /clear - Discard and start fresh'
      );
    } else {
      await ctx.reply('No active conversation. Just start chatting!');
    }
  }

  private async handleClear(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    const messages = this.conversationState.getMessages(userId);
    if (messages.length === 0) {
      await ctx.reply('No active conversation to clear.');
      return;
    }

    this.conversationState.clearConversation(userId);
    
    // Mark conversation as archived in DB
    const conversationId = this.conversationState.getConversationId(userId);
    if (conversationId) {
      try {
        await this.supabase.updateConversation(conversationId, {
          status: 'archived',
        });
      } catch (error) {
        console.error('Failed to archive conversation:', error);
      }
    }

    await ctx.reply('✅ Conversation cleared. Start a new one anytime!');
  }

  private async handleMessage(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

    if (!userId || !text) {
      return;
    }

    try {
      // Load user's active conversation from DB if we haven't checked yet
      if (!this.conversationState.hasLoadedUser(userId)) {
        await this.loadUserConversation(userId);
        this.conversationState.markUserAsLoaded(userId);
      }

      // Add user message to conversation state
      this.conversationState.addMessage(userId, {
        role: 'user',
        content: text,
        timestamp: new Date(),
      });

      // Generate response using LLM
      const messages = this.conversationState.getMessages(userId);
      const response = await this.llm.generateResponse(messages);

      // Add assistant response to conversation state
      this.conversationState.addMessage(userId, {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      });

      // Send response to user
      await ctx.reply(response);

      // Save conversation to database after each exchange
      await this.saveConversation(userId);
    } catch (error) {
      console.error('Error handling message:', error);
      await ctx.reply('Sorry, I encountered an error. Please try again.');
    }
  }

  private async saveConversation(userId: string): Promise<void> {
    const conversationId = this.conversationState.getConversationId(userId);
    const messages = this.conversationState.getMessages(userId);

    if (!conversationId) {
      return;
    }

    const transcript = messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n\n');

    try {
      // Check if conversation exists
      const existing = await this.supabase.getConversation(conversationId);

      if (existing) {
        await this.supabase.updateConversation(conversationId, {
          rawTranscript: transcript,
        });
      } else {
        await this.supabase.createConversation({
          id: conversationId,
          userId: userId,
          rawTranscript: transcript,
          status: 'active',
        });
      }
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  }

  private async extractAndSave(userId: string): Promise<void> {
    const conversationId = this.conversationState.getConversationId(userId);
    const messages = this.conversationState.getMessages(userId);

    if (!conversationId || messages.length === 0) {
      throw new Error('No active conversation');
    }

    // Extract knowledge using LLM
    const extracted = await this.llm.extractKnowledge(messages);

    // Generate embedding for the knowledge
    const embeddingText = `${extracted.problem} ${extracted.context} ${extracted.solution} ${extracted.learnings.join(' ')}`;
    const embedding = await this.openai.generateEmbedding(embeddingText);

    // Save to database
    await this.supabase.createKnowledgeEntry({
      conversationId,
      type: extracted.type,
      problem: extracted.problem,
      context: extracted.context,
      solution: extracted.solution,
      learnings: extracted.learnings,
      tags: extracted.tags,
      embedding,
    });

    // Update conversation status
    await this.supabase.updateConversation(conversationId, {
      status: 'extracted',
    });

    // End conversation
    this.conversationState.endConversation(userId);
  }

  async launch(): Promise<void> {
    await this.initialize();
    await this.bot.launch();
    console.log('Bot started successfully');
  }

  stop(signal?: string): void {
    try {
      this.bot.stop(signal);
      console.log('Bot stopped gracefully');
    } catch (error) {
      // Ignore errors if bot is not running
      console.log('Bot already stopped');
    }
  }
}
