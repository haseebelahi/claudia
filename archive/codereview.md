# Code Review - Improvements to Implement

**Date:** 2026-01-01  
**Status:** Approved for Implementation  
**Priority:** High

This document outlines the improvements identified during architecture review, along with implementation guidance and code samples.

---

## 1. Implement Smart Conversation Persistence Strategy

### Current Issue
Every message triggers a DB write (check if exists + update), which is wasteful and unnecessary.

### New Approach
Save to DB every **10 messages OR 5 minutes**, whichever comes first.

### Benefits
- Reduces DB writes by ~80-90%
- Still provides safety (max 10 messages lost on crash)
- Better performance and lower DB costs

### Implementation

#### Step 1: Add Persistence Tracking to ConversationState

**File:** `src/models/message.ts`

```typescript
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ConversationState {
  conversationId: string;
  messages: Message[];
  lastActivity: Date;
  isActive: boolean;
  lastSavedAt: Date | null;           // NEW: Track when last saved
  messagesSinceLastSave: number;      // NEW: Count messages since save
}
```

#### Step 2: Update ConversationStateService

**File:** `src/services/conversation-state.service.ts`

```typescript
import { config } from '../config';
import { Conversation, ConversationState, Message } from '../models';

const SAVE_INTERVAL_MS = 300000; // 5 minutes
const SAVE_MESSAGE_THRESHOLD = 10; // 10 messages

export class ConversationStateService {
  private conversations: Map<string, ConversationState> = new Map();
  private loadedUsers: Set<string> = new Set();

  constructor() {}

  loadConversationFromDB(conversation: Conversation): void {
    const messages = this.parseTranscript(conversation.rawTranscript);

    const state: ConversationState = {
      conversationId: conversation.id,
      messages,
      lastActivity: conversation.updatedAt,
      isActive: conversation.status === 'active',
      lastSavedAt: conversation.updatedAt,     // NEW
      messagesSinceLastSave: 0,                 // NEW
    };

    if (conversation.userId) {
      this.conversations.set(conversation.userId, state);
      this.loadedUsers.add(conversation.userId);
    }
  }

  hasLoadedUser(userId: string): boolean {
    return this.loadedUsers.has(userId);
  }

  markUserAsLoaded(userId: string): void {
    this.loadedUsers.add(userId);
  }

  getOrCreateConversation(userId: string): ConversationState {
    let state = this.conversations.get(userId);
    
    if (!state) {
      // Create new conversation
      state = {
        conversationId: crypto.randomUUID(),
        messages: [],
        lastActivity: new Date(),
        isActive: true,
        lastSavedAt: null,                    // NEW
        messagesSinceLastSave: 0,             // NEW
      };
      this.conversations.set(userId, state);
    }

    return state;
  }

  private parseTranscript(transcript: string): Message[] {
    if (!transcript) {
      return [];
    }

    const messages: Message[] = [];
    const lines = transcript.split('\n\n');

    for (const line of lines) {
      const match = line.match(/^(user|assistant): (.+)$/s);
      if (match) {
        messages.push({
          role: match[1] as 'user' | 'assistant',
          content: match[2],
          timestamp: new Date(),
        });
      }
    }

    return messages;
  }

  addMessage(userId: string, message: Message): void {
    const state = this.getOrCreateConversation(userId);
    state.messages.push(message);
    state.lastActivity = new Date();
    state.messagesSinceLastSave++;              // NEW: Increment counter

    // Trim conversation if too long
    if (state.messages.length > config.app.maxConversationLength) {
      state.messages = state.messages.slice(-config.app.maxConversationLength);
    }
  }

  // NEW: Check if conversation needs saving
  shouldSaveConversation(userId: string): boolean {
    const state = this.conversations.get(userId);
    if (!state) return false;

    // Save if 10+ messages since last save
    if (state.messagesSinceLastSave >= SAVE_MESSAGE_THRESHOLD) {
      return true;
    }

    // Save if 5+ minutes since last save
    if (state.lastSavedAt) {
      const timeSinceLastSave = Date.now() - state.lastSavedAt.getTime();
      if (timeSinceLastSave >= SAVE_INTERVAL_MS) {
        return true;
      }
    } else {
      // Never saved before, should save
      return true;
    }

    return false;
  }

  // NEW: Mark conversation as saved
  markConversationSaved(userId: string): void {
    const state = this.conversations.get(userId);
    if (state) {
      state.lastSavedAt = new Date();
      state.messagesSinceLastSave = 0;
    }
  }

  getMessages(userId: string): Message[] {
    const state = this.conversations.get(userId);
    return state?.messages || [];
  }

  getConversationId(userId: string): string | null {
    const state = this.conversations.get(userId);
    return state?.conversationId || null;
  }

  isConversationActive(userId: string): boolean {
    const state = this.conversations.get(userId);
    return state?.isActive || false;
  }

  endConversation(userId: string): ConversationState | null {
    const state = this.conversations.get(userId);
    if (!state) {
      return null;
    }

    state.isActive = false;

    // Clean up after a grace period (1 hour)
    setTimeout(() => {
      this.conversations.delete(userId);
      this.loadedUsers.delete(userId);
      console.log(`Cleaned up conversation for user ${userId}`);
    }, 3600000);

    return state;
  }

  clearConversation(userId: string): void {
    this.conversations.delete(userId);
    this.loadedUsers.delete(userId);
  }
}
```

#### Step 3: Update TelegramHandler

**File:** `src/handlers/telegram.handler.ts`

```typescript
// In handleMessage method, replace the save logic:

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

    // UPDATED: Only save if threshold reached
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

// UPDATED: Also save before extraction to ensure nothing is lost
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
    // UPDATED: Save conversation before extraction to ensure it's persisted
    await this.saveConversation(userId);
    this.conversationState.markConversationSaved(userId);
    
    await this.extractAndSave(userId);
    await ctx.reply('✅ Knowledge extracted and saved!');
  } catch (error) {
    console.error('Failed to extract knowledge:', error);
    await ctx.reply('Failed to extract knowledge. Please try again.');
  }
}
```

---

## 2. Implement Repository Pattern

### Current Issue
`SupabaseService` is used directly throughout the codebase. This:
- Couples business logic to Supabase implementation
- Makes testing harder (need to mock Supabase client)
- Violates the architecture documented in AGENTS.md

### New Approach
Create repository layer between handlers/services and database.

### Benefits
- Cleaner separation of concerns
- Easier to test (mock repositories instead of Supabase)
- Future-proof (easier to switch databases if needed)
- Follows documented architecture

### Implementation

#### Step 1: Create ConversationRepository

**File:** `src/repositories/conversation.repository.ts`

```typescript
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
}
```

#### Step 2: Create KnowledgeRepository

**File:** `src/repositories/knowledge.repository.ts`

```typescript
import { KnowledgeEntry, KnowledgeEntryInsert, KnowledgeSearchResult } from '../models';
import { SupabaseService } from '../services';

export class KnowledgeRepository {
  constructor(private supabase: SupabaseService) {}

  async save(entry: KnowledgeEntryInsert): Promise<KnowledgeEntry> {
    return this.supabase.createKnowledgeEntry(entry);
  }

  async findById(id: string): Promise<KnowledgeEntry | null> {
    // Implement if needed for Phase 2
    throw new Error('Not implemented yet');
  }

  async search(
    embedding: number[],
    threshold: number = 0.7,
    limit: number = 10
  ): Promise<KnowledgeSearchResult[]> {
    return this.supabase.searchKnowledge(embedding, threshold, limit);
  }

  async findByConversationId(conversationId: string): Promise<KnowledgeEntry[]> {
    // Implement if needed
    throw new Error('Not implemented yet');
  }

  async findByTags(tags: string[]): Promise<KnowledgeEntry[]> {
    // Implement for Phase 2+
    throw new Error('Not implemented yet');
  }
}
```

#### Step 3: Create Repository Index

**File:** `src/repositories/index.ts`

```typescript
export * from './conversation.repository';
export * from './knowledge.repository';
```

#### Step 4: Update TelegramHandler to Use Repositories

**File:** `src/handlers/telegram.handler.ts`

```typescript
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
  
  // UPDATED: Use repositories instead of SupabaseService directly
  private conversationRepo: ConversationRepository;
  private knowledgeRepo: KnowledgeRepository;

  constructor() {
    this.bot = new Telegraf(config.telegram.botToken);
    this.conversationState = new ConversationStateService();
    this.llm = new LLMService();
    this.openai = new OpenAIService();
    
    // UPDATED: Initialize repositories
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
      // UPDATED: Use repository
      const conversation = await this.conversationRepo.findActiveByUserId(userId);
      
      if (conversation) {
        console.log(`Loading active conversation for user ${userId}: ${conversation.id}`);
        this.conversationState.loadConversationFromDB(conversation);
      }
    } catch (error) {
      console.error(`Failed to load conversation for user ${userId}:`, error);
    }
  }

  // ... setupHandlers() remains the same ...

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
        // UPDATED: Use repository
        await this.conversationRepo.update(conversationId, {
          status: 'archived',
        });
      } catch (error) {
        console.error('Failed to archive conversation:', error);
      }
    }

    await ctx.reply('✅ Conversation cleared. Start a new one anytime!');
  }

  // ... handleMessage() as updated in Section 1 ...

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
      // UPDATED: Use repository's save method (handles create vs update)
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

    // Extract knowledge using LLM
    const extracted = await this.llm.extractKnowledge(messages);

    // Generate embedding for the knowledge
    const embeddingText = `${extracted.problem} ${extracted.context} ${extracted.solution} ${extracted.learnings.join(' ')}`;
    const embedding = await this.openai.generateEmbedding(embeddingText);

    // UPDATED: Use repositories
    await this.knowledgeRepo.save({
      conversationId,
      type: extracted.type,
      problem: extracted.problem,
      context: extracted.context,
      solution: extracted.solution,
      learnings: extracted.learnings,
      tags: extracted.tags,
      embedding,
    });

    await this.conversationRepo.update(conversationId, {
      status: 'extracted',
    });

    // End conversation
    this.conversationState.endConversation(userId);
  }

  // ... rest of the class remains the same ...
}
```

---

## 3. Increase Max Conversation Length

### Current Issue
50 messages is too conservative. Claude 3.5 Sonnet supports ~200K tokens.

### New Approach
Increase to 200 messages to allow deeper conversations.

### Implementation

**File:** `.env`

```env
# Increase from 50 to 200
MAX_CONVERSATION_LENGTH=200
```

**File:** `.env.example`

```env
# Update the example as well
MAX_CONVERSATION_LENGTH=200
```

---

## 4. Remove Conversation Timeout

### Current Issue
5-minute timeout ends conversations prematurely. Telegram is async - users might step away and return later.

### New Approach
Remove timeout entirely. Conversations stay active until explicitly extracted or cleared.

### Implementation

#### Step 1: Remove Timeout from Config

**File:** `src/config/index.ts`

```typescript
import dotenv from 'dotenv';

dotenv.config();

interface Config {
  telegram: {
    botToken: string;
  };
  llm: {
    apiKey: string;
    model: string;
    baseUrl: string;
  };
  openai: {
    apiKey: string;
  };
  supabase: {
    url: string;
    key: string;
  };
  app: {
    nodeEnv: string;
    port: number;
    maxConversationLength: number;
    // REMOVED: conversationTimeoutMs
  };
}

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config: Config = {
  telegram: {
    botToken: getEnvVar('TELEGRAM_BOT_TOKEN'),
  },
  llm: {
    apiKey: getEnvVar('OPENROUTER_API_KEY'),
    model: process.env.LLM_MODEL || 'anthropic/claude-3.5-sonnet',
    baseUrl: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
  },
  openai: {
    apiKey: getEnvVar('OPENAI_API_KEY'),
  },
  supabase: {
    url: getEnvVar('SUPABASE_URL'),
    key: getEnvVar('SUPABASE_KEY'),
  },
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    maxConversationLength: parseInt(process.env.MAX_CONVERSATION_LENGTH || '200', 10),
    // REMOVED: conversationTimeoutMs
  },
};
```

#### Step 2: Remove Timeout Logic from ConversationStateService

**File:** `src/services/conversation-state.service.ts`

```typescript
export class ConversationStateService {
  private conversations: Map<string, ConversationState> = new Map();
  private loadedUsers: Set<string> = new Set();
  // REMOVED: private timeouts: Map<string, NodeJS.Timeout> = new Map();

  // ... other methods remain the same ...

  addMessage(userId: string, message: Message): void {
    const state = this.getOrCreateConversation(userId);
    state.messages.push(message);
    state.lastActivity = new Date();
    state.messagesSinceLastSave++;

    // Trim conversation if too long
    if (state.messages.length > config.app.maxConversationLength) {
      state.messages = state.messages.slice(-config.app.maxConversationLength);
    }

    // REMOVED: this.resetTimeout(userId);
  }

  // ... other methods ...

  endConversation(userId: string): ConversationState | null {
    const state = this.conversations.get(userId);
    if (!state) {
      return null;
    }

    state.isActive = false;
    // REMOVED: this.clearTimeout(userId);

    // Clean up after a grace period (1 hour)
    setTimeout(() => {
      this.conversations.delete(userId);
      this.loadedUsers.delete(userId);
      console.log(`Cleaned up conversation for user ${userId}`);
    }, 3600000);

    return state;
  }

  clearConversation(userId: string): void {
    this.conversations.delete(userId);
    this.loadedUsers.delete(userId);
    // REMOVED: this.clearTimeout(userId);
  }

  // REMOVED: resetTimeout() method
  // REMOVED: clearTimeout() method
}
```

#### Step 3: Update Documentation

**File:** `CONVERSATION_MANAGEMENT.md`

```markdown
# Conversation Management

## Changes Made

### 3. Conversation Lifecycle

**Starting a conversation:**
- Just send a message - conversation starts automatically
- Each user gets their own conversation (tracked by Telegram user ID)

**During conversation:**
- Every 10 messages OR 5 minutes, conversation auto-saved to database
- Conversation state maintained in memory
- No timeout - conversations stay active indefinitely

**Ending a conversation:**
- `/extract` - Extracts knowledge, saves to DB, ends conversation
- `/clear` - Discards conversation, marks as archived
```

**File:** `.env.example`

```env
# REMOVED: CONVERSATION_TIMEOUT_MS=300000
```

---

## 5. Fix Memory Leak (Abandoned Conversations)

### Current Issue
Conversations stay in memory forever, even after timeout ends them.

### Solution
Already implemented in Section 4 above:

```typescript
endConversation(userId: string): ConversationState | null {
  const state = this.conversations.get(userId);
  if (!state) {
    return null;
  }

  state.isActive = false;

  // Clean up after a grace period (1 hour)
  setTimeout(() => {
    this.conversations.delete(userId);
    this.loadedUsers.delete(userId);
    console.log(`Cleaned up conversation for user ${userId}`);
  }, 3600000);

  return state;
}
```

This ensures:
- Conversation stays in memory for 1 hour after ending (for potential retry of extraction)
- After 1 hour, conversation is removed from memory
- No memory leak accumulation

---

## 6. Improve Extraction Error Handling

### Current Issue
If extraction partially succeeds (e.g., knowledge saved but DB update fails), conversation state becomes inconsistent.

### Solution
Ensure atomic extraction with better error recovery.

### Implementation

**File:** `src/handlers/telegram.handler.ts`

```typescript
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
```

---

## 7. Add Retry Logic for Embeddings

### Current Issue
OpenAI API calls can fail due to rate limits or transient network issues. No retry logic exists.

### Solution
Add exponential backoff retry for embedding generation.

### Implementation

**File:** `src/services/openai.service.ts`

```typescript
import OpenAI from 'openai';

import { config } from '../config';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  // Helper function for exponential backoff
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateEmbedding(text: string, maxRetries: number = 3): Promise<number[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.client.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
        });

        return response.data[0].embedding;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on the last attempt
        if (attempt === maxRetries - 1) {
          break;
        }

        // Calculate backoff delay: 1s, 2s, 4s
        const delayMs = 1000 * Math.pow(2, attempt);
        
        console.warn(
          `OpenAI embedding attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}. ` +
          `Retrying in ${delayMs}ms...`
        );
        
        await this.sleep(delayMs);
      }
    }

    // All retries failed
    console.error(`OpenAI API error after ${maxRetries} attempts:`, lastError);
    throw new Error(`Failed to generate embedding after ${maxRetries} attempts: ${lastError?.message}`);
  }

  async generateEmbeddings(texts: string[], maxRetries: number = 3): Promise<number[][]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.client.embeddings.create({
          model: 'text-embedding-3-small',
          input: texts,
        });

        return response.data.map((item) => item.embedding);
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries - 1) {
          break;
        }

        const delayMs = 1000 * Math.pow(2, attempt);
        
        console.warn(
          `OpenAI embeddings (batch) attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}. ` +
          `Retrying in ${delayMs}ms...`
        );
        
        await this.sleep(delayMs);
      }
    }

    console.error(`OpenAI API error after ${maxRetries} attempts:`, lastError);
    throw new Error(`Failed to generate embeddings after ${maxRetries} attempts: ${lastError?.message}`);
  }
}
```

---

## Implementation Checklist

Use this checklist to track implementation progress:

### Core Changes
- [ ] **1.1** Add `lastSavedAt` and `messagesSinceLastSave` to `ConversationState` interface
- [ ] **1.2** Implement `shouldSaveConversation()` in `ConversationStateService`
- [ ] **1.3** Implement `markConversationSaved()` in `ConversationStateService`
- [ ] **1.4** Update `handleMessage()` to use smart save logic
- [ ] **1.5** Update `handleExtract()` to save before extraction

### Repository Pattern
- [ ] **2.1** Create `src/repositories/conversation.repository.ts`
- [ ] **2.2** Create `src/repositories/knowledge.repository.ts`
- [ ] **2.3** Create `src/repositories/index.ts`
- [ ] **2.4** Update `TelegramHandler` to use repositories
- [ ] **2.5** Update service exports in `src/services/index.ts` if needed

### Configuration Updates
- [ ] **3.1** Update `MAX_CONVERSATION_LENGTH=200` in `.env`
- [ ] **3.2** Update `MAX_CONVERSATION_LENGTH=200` in `.env.example`
- [ ] **4.1** Remove `conversationTimeoutMs` from `Config` interface
- [ ] **4.2** Remove timeout logic from `ConversationStateService`
- [ ] **4.3** Remove `CONVERSATION_TIMEOUT_MS` from `.env.example`

### Bug Fixes
- [ ] **5.1** Add cleanup timer in `endConversation()` (1 hour grace period)
- [ ] **6.1** Improve `extractAndSave()` error handling with logging
- [ ] **7.1** Add retry logic to `generateEmbedding()` in `OpenAIService`
- [ ] **7.2** Add retry logic to `generateEmbeddings()` in `OpenAIService`

### Documentation Updates
- [ ] **8.1** Update `CONVERSATION_MANAGEMENT.md` to reflect no timeout
- [ ] **8.2** Update `CONVERSATION_PERSISTENCE.md` to reflect smart save strategy
- [ ] **8.3** Update `AGENTS.md` to mention repository pattern is now implemented

### Testing (After Implementation)
- [ ] **9.1** Test conversation saves after 10 messages
- [ ] **9.2** Test conversation saves after 5 minutes
- [ ] **9.3** Test extraction success
- [ ] **9.4** Test extraction failure recovery (conversation stays active)
- [ ] **9.5** Test memory cleanup after 1 hour of inactivity
- [ ] **9.6** Test embedding retry on transient failure
- [ ] **9.7** Test 200-message conversation doesn't lose early context

---

## Testing Plan

### Manual Testing Scenarios

#### Scenario 1: Smart Save (10 messages threshold)
1. Start conversation
2. Send 9 messages back and forth
3. Check DB - should NOT have saved yet
4. Send 10th message
5. Check DB - should have saved conversation

#### Scenario 2: Smart Save (5 minute threshold)
1. Start conversation
2. Send 3 messages
3. Wait 5+ minutes
4. Send another message
5. Check DB - should have saved conversation

#### Scenario 3: Extraction Failure Recovery
1. Start conversation
2. Temporarily disable OpenAI API key (to simulate failure)
3. Try `/extract`
4. Should get error message
5. Fix API key
6. Try `/extract` again
7. Should succeed

#### Scenario 4: Long Conversation (200 messages)
1. Start conversation
2. Send 200+ messages (can script this)
3. Use `/extract`
4. Check knowledge entry - should reference early conversation context

#### Scenario 5: Memory Cleanup
1. Start conversation
2. Send a few messages
3. Use `/extract`
4. Wait 1 hour
5. Check application logs - should see cleanup message

---

## Rollback Plan

If any issues arise during deployment:

### Immediate Rollback
```bash
git revert HEAD
git push
# Railway will auto-deploy previous version
```

### Partial Rollback (Keep Some Changes)
```bash
# Revert specific commits
git revert <commit-hash>
git push
```

### Database Changes
No database schema changes in this review, so no DB rollback needed.

---

## Post-Implementation Validation

After deploying all changes:

1. **Monitor Railway logs** for any errors
2. **Check Supabase dashboard** - DB query count should decrease significantly
3. **Test with real usage** - Have a conversation and verify extraction works
4. **Monitor OpenAI costs** - Should see retry logging if rate limits hit
5. **Check memory usage** - Should stay stable over 24-48 hours

---

## Notes

- All changes are backward compatible (no database schema changes)
- Changes can be deployed incrementally (e.g., implement repositories first, then smart save)
- No user-facing behavior changes (except removing timeout, which improves UX)
- Production deployment on Railway will auto-deploy on git push to main

---

**Estimated Implementation Time:** 3-4 hours  
**Priority:** High  
**Risk Level:** Low (all changes are additive or improvements)
