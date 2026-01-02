import { Context, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { config } from '../config';
import {
  ConversationStateService,
  LLMService,
  OpenAIService,
  SupabaseService,
} from '../services';
import {
  ConversationRepository,
  KnowledgeRepository,
} from '../repositories';

export class TelegramHandler {
  private bot: Telegraf;
  private conversationState: ConversationStateService;
  private llm: LLMService;
  private openai: OpenAIService;
  private conversationRepo: ConversationRepository;
  private knowledgeRepo: KnowledgeRepository;

  constructor() {
    this.bot = new Telegraf(config.telegram.botToken);
    this.conversationState = new ConversationStateService();
    this.llm = new LLMService();
    this.openai = new OpenAIService();
    
    const supabase = new SupabaseService();
    this.conversationRepo = new ConversationRepository(supabase);
    this.knowledgeRepo = new KnowledgeRepository(supabase);

    this.setupHandlers();
  }

  async initialize(): Promise<void> {
    console.log('Bot initialized. Conversations will be loaded on-demand when users message.');
  }

  private async loadUserConversation(userId: string): Promise<void> {
    try {
      const conversation = await this.conversationRepo.findActiveByUserId(userId);
      
      if (conversation) {
        console.log(`Loading active conversation for user ${userId}: ${conversation.id}`);
        this.conversationState.loadConversationFromDB(conversation);
      }
    } catch (error) {
      console.error(`Failed to load conversation for user ${userId}:`, error);
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

    // Show command - display complete current conversation
    this.bot.command('show', async (ctx) => {
      await this.handleShow(ctx);
    });

    // History command - show previous non-extracted conversations
    this.bot.command('history', async (ctx) => {
      await this.handleHistory(ctx);
    });

    // Discard command - delete a specific previous conversation
    this.bot.command('discard', async (ctx) => {
      await this.handleDiscard(ctx);
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
      // Save conversation before extraction to ensure it's persisted
      await this.saveConversation(userId);
      this.conversationState.markConversationSaved(userId);
      
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
    
    const conversationId = this.conversationState.getConversationId(userId);
    if (conversationId) {
      try {
        await this.conversationRepo.update(conversationId, {
          status: 'archived',
        });
      } catch (error) {
        console.error('Failed to archive conversation:', error);
      }
    }

    await ctx.reply('✅ Conversation cleared. Start a new one anytime!');
  }

  private async handleShow(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    const messages = this.conversationState.getMessages(userId);
    if (messages.length === 0) {
      await ctx.reply('No active conversation to show.');
      return;
    }

    const conversationId = this.conversationState.getConversationId(userId);
    
    // Format the conversation nicely
    let transcript = `📜 *Current Conversation* (${messages.length} messages)\n`;
    transcript += `ID: \`${conversationId}\`\n\n`;
    
    messages.forEach((msg, index) => {
      const speaker = msg.role === 'user' ? '👤 You' : '🤖 Assistant';
      const time = msg.timestamp.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      transcript += `*${index + 1}. ${speaker}* (${time})\n`;
      // Truncate long messages
      const content = msg.content.length > 200 
        ? msg.content.substring(0, 200) + '...' 
        : msg.content;
      transcript += `${content}\n\n`;
    });

    transcript += `\n💡 Use /extract to save this conversation as knowledge`;
    transcript += `\n🗑 Use /clear to discard this conversation`;

    await ctx.reply(transcript, { parse_mode: 'Markdown' });
  }

  private async handleHistory(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    try {
      const conversations = await this.conversationRepo.findNonExtractedByUserId(userId);
      
      if (conversations.length === 0) {
        await ctx.reply('No previous conversations found.\n\nAll your conversations have been extracted or cleared.');
        return;
      }

      let response = `📚 *Previous Conversations* (${conversations.length})\n\n`;
      response += `These conversations have not been extracted yet:\n\n`;

      conversations.forEach((conv, index) => {
        const date = conv.updatedAt.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        
        // Count messages in transcript
        const messageCount = conv.rawTranscript.split('\n\n').filter(line => 
          line.startsWith('user:') || line.startsWith('assistant:')
        ).length;

        response += `${index + 1}. *${conv.status.toUpperCase()}* - ${messageCount} messages\n`;
        response += `   📅 Last updated: ${date}\n`;
        response += `   🆔 ID: \`${conv.id}\`\n`;
        
        // Show preview of first message
        const firstMessage = conv.rawTranscript.split('\n\n')[0];
        if (firstMessage) {
          const preview = firstMessage.replace(/^(user|assistant): /, '');
          const truncated = preview.length > 80 ? preview.substring(0, 80) + '...' : preview;
          response += `   💬 "${truncated}"\n`;
        }
        response += `\n`;
      });

      response += `\n💡 To discard a conversation, use:\n`;
      response += `/discard \`conversation_id\``;

      await ctx.reply(response, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Failed to fetch conversation history:', error);
      await ctx.reply('Sorry, I could not retrieve your conversation history. Please try again.');
    }
  }

  private async handleDiscard(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    // Extract conversation ID from command
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.split(' ');
    
    if (parts.length < 2) {
      await ctx.reply(
        '❌ Please provide a conversation ID.\n\n' +
        'Usage: `/discard` `conversation_id`\n\n' +
        'Use /history to see your previous conversations.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const conversationId = parts[1].trim();

    try {
      // Verify the conversation belongs to the user
      const conversation = await this.conversationRepo.findById(conversationId);
      
      if (!conversation) {
        await ctx.reply('❌ Conversation not found.');
        return;
      }

      if (conversation.userId !== userId) {
        await ctx.reply('❌ You can only discard your own conversations.');
        return;
      }

      if (conversation.status === 'extracted') {
        await ctx.reply(
          '❌ This conversation has already been extracted.\n\n' +
          'Extracted conversations cannot be discarded as they\'ve been saved as knowledge.'
        );
        return;
      }

      // Check if it's the active conversation
      const activeConvId = this.conversationState.getConversationId(userId);
      if (activeConvId === conversationId) {
        await ctx.reply(
          '❌ This is your current active conversation.\n\n' +
          'Use /clear instead to discard your current conversation.'
        );
        return;
      }

      // Delete the conversation
      await this.conversationRepo.delete(conversationId);

      await ctx.reply(
        '✅ Conversation discarded successfully.\n\n' +
        `ID: \`${conversationId}\`\n\n` +
        'Use /history to see your remaining conversations.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Failed to discard conversation:', error);
      await ctx.reply('Sorry, I could not discard that conversation. Please try again.');
    }
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

      // Only save if threshold reached
      if (this.conversationState.shouldSaveConversation(userId)) {
        await this.saveConversation(userId);
        this.conversationState.markConversationSaved(userId);
        console.log(`Conversation saved for user ${userId} (threshold reached)`);
      }
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
      await this.conversationRepo.save({
        id: conversationId,
        userId: userId,
        rawTranscript: transcript,
        status: 'active',
      });
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

    let knowledgeEntry = null;

    try {
      // Step 1: Extract knowledge using LLM
      const extracted = await this.llm.extractKnowledge(messages);
      console.log(`Knowledge extracted for conversation ${conversationId}`);

      // Step 2: Generate embedding
      const embeddingText = `${extracted.problem} ${extracted.context} ${extracted.solution} ${extracted.learnings.join(' ')}`;
      const embedding = await this.openai.generateEmbedding(embeddingText);
      console.log(`Embedding generated for conversation ${conversationId}`);

      // Step 3: Save knowledge entry
      knowledgeEntry = await this.knowledgeRepo.save({
        conversationId,
        type: extracted.type,
        problem: extracted.problem,
        context: extracted.context,
        solution: extracted.solution,
        learnings: extracted.learnings,
        tags: extracted.tags,
        embedding,
      });
      console.log(`Knowledge entry saved: ${knowledgeEntry.id}`);

      // Step 4: Update conversation status (only after knowledge is saved)
      await this.conversationRepo.update(conversationId, {
        status: 'extracted',
      });
      console.log(`Conversation ${conversationId} marked as extracted`);

      // Step 5: End conversation (only after everything succeeded)
      this.conversationState.endConversation(userId);
      console.log(`Conversation ended for user ${userId}`);
      
    } catch (error) {
      // Log the failure stage
      if (!knowledgeEntry) {
        console.error('Extraction failed before saving knowledge entry:', error);
      } else {
        console.error('Extraction succeeded but failed to update conversation status:', error);
      }
      
      // Keep conversation active so user can retry
      // Do NOT call endConversation() here
      throw error;
    }
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
