import { Context, Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';

import { config } from '../config';
import { ExtractedThought, ThoughtKind } from '../models';
import {
  ConversationStateService,
  LLMService,
  OpenAIService,
  SupabaseService,
} from '../services';
import {
  ConversationRepository,
  ThoughtRepository,
  SourceRepository,
} from '../repositories';

// Pending remember confirmations - maps uniqueId to pending data
interface PendingRemember {
  userId: string;
  fact: string;
  thought: ExtractedThought;
  createdAt: Date;
}

export class TelegramHandler {
  private bot: Telegraf;
  private conversationState: ConversationStateService;
  private llm: LLMService;
  private openai: OpenAIService;
  private conversationRepo: ConversationRepository;
  private thoughtRepo: ThoughtRepository;
  private sourceRepo: SourceRepository;
  private pendingRemember: Map<string, PendingRemember> = new Map();

  constructor() {
    this.bot = new Telegraf(config.telegram.botToken);
    this.conversationState = new ConversationStateService();
    this.llm = new LLMService();
    this.openai = new OpenAIService();

    const supabase = new SupabaseService();
    this.conversationRepo = new ConversationRepository(supabase);
    this.thoughtRepo = new ThoughtRepository(supabase);
    this.sourceRepo = new SourceRepository(supabase);

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

    // Recall command - semantic search of knowledge base
    this.bot.command('recall', async (ctx) => {
      await this.handleRecall(ctx);
    });

    // Remember command - quick fact storage with categorization
    this.bot.command('remember', async (ctx) => {
      await this.handleRemember(ctx);
    });

    // Callback query handlers for inline buttons
    this.bot.action(/^remember_confirm:(.+)$/, async (ctx) => {
      await this.handleRememberConfirm(ctx);
    });

    this.bot.action(/^remember_change:(.+)$/, async (ctx) => {
      await this.handleRememberChange(ctx);
    });

    this.bot.action(/^remember_type:(.+):(.+)$/, async (ctx) => {
      await this.handleRememberTypeSelect(ctx);
    });

    this.bot.action(/^remember_cancel:(.+)$/, async (ctx) => {
      await this.handleRememberCancel(ctx);
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

  private async handleRecall(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    // Extract topic from command
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const topic = text.replace(/^\/recall\s*/i, '').trim();

    if (!topic) {
      await ctx.reply(
        '🔍 *Recall Thoughts*\n\n' +
        'Search your knowledge base by topic.\n\n' +
        'Usage: `/recall [topic]`\n\n' +
        'Examples:\n' +
        '• `/recall kubernetes memory issues`\n' +
        '• `/recall debugging JVM`\n' +
        '• `/recall TypeScript best practices`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    await ctx.reply(`🔍 Searching for "${topic}"...`);

    try {
      // Generate embedding for the search query
      const embedding = await this.openai.generateEmbedding(topic);

      // Search thoughts with user filter
      const results = await this.thoughtRepo.search(
        embedding,
        0.5,  // Lower threshold to catch more results
        5,    // Limit to 5 results
        userId
      );

      if (results.length === 0) {
        await ctx.reply(
          `No matching thoughts found for "${topic}".\n\n` +
          'Try:\n' +
          '• Using different keywords\n' +
          '• Being more specific or general\n' +
          '• Having a conversation and using /extract to save thoughts first'
        );
        return;
      }

      // Format results
      let response = `🧠 *Found ${results.length} thought${results.length > 1 ? 's' : ''}*\n\n`;

      results.forEach((result, index) => {
        const similarity = Math.round(result.similarity * 100);
        const date = result.createdAt.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        response += `*${index + 1}. ${this.formatThoughtKind(result.kind)}* (${similarity}% match)\n`;
        response += `📅 ${date} • ${result.domain}\n`;

        // Claim (the main content)
        const claim = result.claim.length > 200
          ? result.claim.substring(0, 200) + '...'
          : result.claim;
        response += `💡 ${claim}\n`;

        // Context if available
        if (result.context) {
          const context = result.context.length > 100
            ? result.context.substring(0, 100) + '...'
            : result.context;
          response += `📌 ${context}\n`;
        }

        // Actionables (show first 2)
        if (result.actionables && result.actionables.length > 0) {
          const actionablesToShow = result.actionables.slice(0, 2);
          response += `📝 Actions:\n`;
          actionablesToShow.forEach((action) => {
            const truncated = action.length > 80
              ? action.substring(0, 80) + '...'
              : action;
            response += `  • ${truncated}\n`;
          });
          if (result.actionables.length > 2) {
            response += `  • _(+${result.actionables.length - 2} more)_\n`;
          }
        }

        // Tags
        if (result.tags && result.tags.length > 0) {
          response += `🏷 ${result.tags.join(', ')}\n`;
        }

        response += '\n';
      });

      await ctx.reply(response, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Failed to recall thoughts:', error);
      await ctx.reply('Sorry, I could not search your knowledge base. Please try again.');
    }
  }

  private formatThoughtKind(kind: string): string {
    const kindLabels: Record<string, string> = {
      heuristic: 'Heuristic',
      lesson: 'Lesson',
      decision: 'Decision',
      observation: 'Observation',
      principle: 'Principle',
      fact: 'Fact',
      preference: 'Preference',
      feeling: 'Feeling',
      goal: 'Goal',
      prediction: 'Prediction',
    };
    return kindLabels[kind] || kind;
  }

  /**
   * Escape special characters for Telegram Markdown
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  private async handleRemember(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    // Extract fact from command
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const fact = text.replace(/^\/remember\s*/i, '').trim();

    if (!fact) {
      await ctx.reply(
        '📝 *Remember Something*\n\n' +
        'Quickly save a fact, preference, feeling, goal, or observation.\n\n' +
        'Usage: `/remember [what to remember]`\n\n' +
        'Examples:\n' +
        '• `/remember Python 3.12 was released in October 2023`\n' +
        '• `/remember I prefer Delta airlines for domestic flights`\n' +
        '• `/remember I feel drained after long meetings`\n' +
        '• `/remember I want to learn Rust this year`\n' +
        '• `/remember Morning is my most productive time`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    await ctx.reply('Analyzing what you want to remember...');

    try {
      // Categorize as thought using LLM
      const thought = await this.llm.categorizeAsThought(fact);

      // Generate unique ID for this pending remember
      const uniqueId = `${userId}_${Date.now()}`;

      // Store pending data
      this.pendingRemember.set(uniqueId, {
        userId,
        fact,
        thought,
        createdAt: new Date(),
      });

      // Create inline keyboard with confirm/change options
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(`✅ ${this.formatThoughtKind(thought.kind)}`, `remember_confirm:${uniqueId}`),
          Markup.button.callback('🔄 Change', `remember_change:${uniqueId}`),
        ],
        [
          Markup.button.callback('❌ Cancel', `remember_cancel:${uniqueId}`),
        ],
      ]);

      await ctx.reply(
        `📝 *I'll remember this as:*\n\n` +
        `*Kind:* ${this.formatThoughtKind(thought.kind)}\n` +
        `*Domain:* ${thought.domain}\n` +
        `*Claim:* ${this.escapeMarkdown(thought.claim)}\n` +
        `*Tags:* ${thought.tags.map(t => this.escapeMarkdown(t)).join(', ')}\n\n` +
        `Is this correct?`,
        { parse_mode: 'Markdown', ...keyboard }
      );
    } catch (error) {
      console.error('Failed to categorize as thought:', error);
      await ctx.reply('Sorry, I could not process that. Please try again.');
    }
  }

  private async handleRememberConfirm(ctx: Context): Promise<void> {
    const match = (ctx.callbackQuery as any)?.data?.match(/^remember_confirm:(.+)$/);
    if (!match) {
      await ctx.answerCbQuery('Invalid action');
      return;
    }

    const uniqueId = match[1];
    const pending = this.pendingRemember.get(uniqueId);

    if (!pending) {
      await ctx.answerCbQuery('This action has expired. Please try again.');
      await ctx.editMessageText('This action has expired. Use /remember to try again.');
      return;
    }

    // Verify user
    const userId = ctx.from?.id.toString();
    if (userId !== pending.userId) {
      await ctx.answerCbQuery('You cannot confirm someone else\'s action.');
      return;
    }

    await ctx.answerCbQuery('Saving...');

    try {
      // Generate embedding from the claim and tags
      const embeddingText = `${pending.thought.claim} ${pending.thought.tags.join(' ')}`;
      const embedding = await this.openai.generateEmbedding(embeddingText);

      // Save as thought
      await this.thoughtRepo.save({
        userId: pending.userId,
        kind: pending.thought.kind,
        domain: pending.thought.domain,
        claim: pending.thought.claim,
        stance: pending.thought.stance,
        confidence: pending.thought.confidence,
        context: pending.thought.context,
        tags: pending.thought.tags,
        embedding,
      });

      // Clean up pending
      this.pendingRemember.delete(uniqueId);

      await ctx.editMessageText(
        `✅ *Saved!*\n\n` +
        `*Kind:* ${this.formatThoughtKind(pending.thought.kind)}\n` +
        `*Claim:* ${this.escapeMarkdown(pending.thought.claim)}\n` +
        `*Tags:* ${pending.thought.tags.map(t => this.escapeMarkdown(t)).join(', ')}\n\n` +
        `Use /recall to search your thoughts later.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Failed to save thought:', error);
      await ctx.editMessageText('Failed to save. Please try /remember again.');
      this.pendingRemember.delete(uniqueId);
    }
  }

  private async handleRememberChange(ctx: Context): Promise<void> {
    const match = (ctx.callbackQuery as any)?.data?.match(/^remember_change:(.+)$/);
    if (!match) {
      await ctx.answerCbQuery('Invalid action');
      return;
    }

    const uniqueId = match[1];
    const pending = this.pendingRemember.get(uniqueId);

    if (!pending) {
      await ctx.answerCbQuery('This action has expired. Please try again.');
      await ctx.editMessageText('This action has expired. Use /remember to try again.');
      return;
    }

    // Verify user
    const userId = ctx.from?.id.toString();
    if (userId !== pending.userId) {
      await ctx.answerCbQuery('You cannot modify someone else\'s action.');
      return;
    }

    await ctx.answerCbQuery();

    // Show kind picker (subset for /remember)
    const kinds: ThoughtKind[] = ['fact', 'preference', 'feeling', 'goal', 'observation'];
    const keyboard = Markup.inlineKeyboard([
      kinds.slice(0, 3).map(kind =>
        Markup.button.callback(this.formatThoughtKind(kind), `remember_type:${uniqueId}:${kind}`)
      ),
      kinds.slice(3).map(kind =>
        Markup.button.callback(this.formatThoughtKind(kind), `remember_type:${uniqueId}:${kind}`)
      ),
      [Markup.button.callback('❌ Cancel', `remember_cancel:${uniqueId}`)],
    ]);

    await ctx.editMessageText(
      `📝 *Select the correct kind:*\n\n` +
      `*Original:* ${this.escapeMarkdown(pending.fact)}`,
      { parse_mode: 'Markdown', ...keyboard }
    );
  }

  private async handleRememberTypeSelect(ctx: Context): Promise<void> {
    const match = (ctx.callbackQuery as any)?.data?.match(/^remember_type:(.+):(.+)$/);
    if (!match) {
      await ctx.answerCbQuery('Invalid action');
      return;
    }

    const uniqueId = match[1];
    const newKind = match[2] as ThoughtKind;
    const pending = this.pendingRemember.get(uniqueId);

    if (!pending) {
      await ctx.answerCbQuery('This action has expired. Please try again.');
      await ctx.editMessageText('This action has expired. Use /remember to try again.');
      return;
    }

    // Verify user
    const userId = ctx.from?.id.toString();
    if (userId !== pending.userId) {
      await ctx.answerCbQuery('You cannot modify someone else\'s action.');
      return;
    }

    // Update the kind
    pending.thought.kind = newKind;
    this.pendingRemember.set(uniqueId, pending);

    await ctx.answerCbQuery('Saving...');

    try {
      // Generate embedding
      const embeddingText = `${pending.thought.claim} ${pending.thought.tags.join(' ')}`;
      const embedding = await this.openai.generateEmbedding(embeddingText);

      // Save as thought
      await this.thoughtRepo.save({
        userId: pending.userId,
        kind: newKind,
        domain: pending.thought.domain,
        claim: pending.thought.claim,
        stance: pending.thought.stance,
        confidence: pending.thought.confidence,
        context: pending.thought.context,
        tags: pending.thought.tags,
        embedding,
      });

      // Clean up pending
      this.pendingRemember.delete(uniqueId);

      await ctx.editMessageText(
        `✅ *Saved!*\n\n` +
        `*Kind:* ${this.formatThoughtKind(newKind)}\n` +
        `*Claim:* ${this.escapeMarkdown(pending.thought.claim)}\n` +
        `*Tags:* ${pending.thought.tags.map(t => this.escapeMarkdown(t)).join(', ')}\n\n` +
        `Use /recall to search your thoughts later.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Failed to save thought:', error);
      await ctx.editMessageText('Failed to save. Please try /remember again.');
      this.pendingRemember.delete(uniqueId);
    }
  }

  private async handleRememberCancel(ctx: Context): Promise<void> {
    const match = (ctx.callbackQuery as any)?.data?.match(/^remember_cancel:(.+)$/);
    if (!match) {
      await ctx.answerCbQuery('Invalid action');
      return;
    }

    const uniqueId = match[1];
    const pending = this.pendingRemember.get(uniqueId);

    if (!pending) {
      await ctx.answerCbQuery('Already cancelled.');
      return;
    }

    // Verify user
    const userId = ctx.from?.id.toString();
    if (userId !== pending.userId) {
      await ctx.answerCbQuery('You cannot cancel someone else\'s action.');
      return;
    }

    // Clean up pending
    this.pendingRemember.delete(uniqueId);

    await ctx.answerCbQuery('Cancelled');
    await ctx.editMessageText('Cancelled. Use /remember to try again.');
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

    let savedThoughts: any[] = [];

    try {
      // Step 1: Extract thoughts using LLM
      const result = await this.llm.extractThoughts(messages);
      console.log(`Extracted ${result.thoughts.length} thought(s) from conversation ${conversationId}`);

      // Step 2: Create source from conversation transcript
      const transcript = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
      const source = await this.sourceRepo.createFromConversation(
        userId,
        transcript,
        `Conversation ${new Date().toISOString().split('T')[0]}`
      );
      console.log(`Source created: ${source.id}`);

      // Step 3: Save each thought with embedding
      for (const thought of result.thoughts) {
        // Generate embedding for the thought
        const embeddingText = `${thought.claim} ${thought.context || ''} ${thought.tags.join(' ')}`;
        const embedding = await this.openai.generateEmbedding(embeddingText);

        // Save thought
        const savedThought = await this.thoughtRepo.save({
          userId,
          kind: thought.kind,
          domain: thought.domain,
          claim: thought.claim,
          stance: thought.stance,
          confidence: thought.confidence,
          context: thought.context,
          evidence: thought.evidence,
          examples: thought.examples,
          actionables: thought.actionables,
          tags: thought.tags,
          embedding,
        });

        // Link thought to source
        await this.thoughtRepo.linkToSource(savedThought.id, source.id);

        savedThoughts.push(savedThought);
        console.log(`Thought saved: ${savedThought.id} (${thought.kind})`);
      }

      // Step 4: Update conversation status
      await this.conversationRepo.update(conversationId, {
        status: 'extracted',
      });
      console.log(`Conversation ${conversationId} marked as extracted`);

      // Step 5: End conversation
      this.conversationState.endConversation(userId);
      console.log(`Conversation ended for user ${userId}`);

    } catch (error) {
      // Log the failure stage
      if (savedThoughts.length === 0) {
        console.error('Extraction failed before saving thoughts:', error);
      } else {
        console.error(`Extraction partially succeeded (${savedThoughts.length} thoughts saved):`, error);
      }

      // Keep conversation active so user can retry
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
