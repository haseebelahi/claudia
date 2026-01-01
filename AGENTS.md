# AGENTS.md - Personal Knowledge Assistant

## Project Overview

A Telegram-based personal knowledge assistant that extracts and recalls learned knowledge through conversational interaction. Uses Claude for conversation, OpenAI for embeddings, and Supabase for storage with vector search.

**Current State:** Early development (Phase 1: Core Extraction Loop)  
**Tech Stack:** Node.js/TypeScript, Telegram Bot API, Claude API, OpenAI API, Supabase (Postgres + pgvector)

See `mvp.md` for full project vision and implementation roadmap.

---

## Build Commands

### Setup
```bash
npm install              # Install dependencies
```

### Development
```bash
npm run dev             # Start development server (once configured)
npm run build           # Compile TypeScript to JavaScript (once configured)
```

### Testing
```bash
npm test                # Run all tests (once configured)
npm test -- <file>      # Run single test file (once configured)
```

**Note:** Testing framework not yet configured. Recommend Jest or Vitest for TypeScript projects.

### Linting & Formatting
```bash
npm run lint            # Run ESLint (once configured)
npm run format          # Run Prettier (once configured)
npm run type-check      # Run TypeScript compiler checks (once configured)
```

**Note:** Linting and formatting not yet configured. Recommend ESLint + Prettier setup.

---

## Project Structure

```
personal-assistant/
├── src/
│   ├── handlers/       # Telegram webhook handlers
│   ├── services/       # Claude, OpenAI, Supabase integrations
│   ├── models/         # Database models and types
│   ├── utils/          # Helper functions
│   └── index.ts        # Entry point
├── tests/              # Test files
├── scripts/            # Database migrations, utilities
├── package.json
├── tsconfig.json
└── .env                # Environment variables (not committed)
```

---

## Code Style Guidelines

### TypeScript

**Target Version:** ES2020 or higher  
**Module System:** CommonJS (current), migrate to ESM if needed  
**Strict Mode:** Enable all strict TypeScript checks

```typescript
// tsconfig.json (recommended)
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  }
}
```

### Imports

**Order:**
1. Node built-ins (e.g., `import fs from 'fs'`)
2. External dependencies (e.g., `import { Telegraf } from 'telegraf'`)
3. Internal absolute imports (e.g., `import { handleMessage } from '@/handlers'`)
4. Relative imports (e.g., `import { helper } from './utils'`)

**Style:**
- Use named imports over default imports when possible
- Group imports by category with blank lines between
- Sort alphabetically within each group

```typescript
// Good
import { readFile } from 'fs/promises';

import Anthropic from '@anthropic-ai/sdk';
import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

import { ConversationService } from '@/services/conversation';
import { KnowledgeEntry } from '@/models/knowledge';

import { formatDate } from './utils';
```

### Formatting

**Indentation:** 2 spaces (not tabs)  
**Line Length:** 100 characters max  
**Quotes:** Single quotes for strings, backticks for templates  
**Semicolons:** Required  
**Trailing Commas:** Use in multi-line objects/arrays

```typescript
// Good
const config = {
  apiKey: process.env.CLAUDE_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 1024,
};

// Bad
const config = {
  apiKey: process.env.CLAUDE_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 1024
}
```

### Naming Conventions

- **Files:** `kebab-case.ts` (e.g., `conversation-handler.ts`)
- **Classes/Interfaces/Types:** `PascalCase` (e.g., `KnowledgeEntry`, `ConversationService`)
- **Functions/Variables:** `camelCase` (e.g., `extractKnowledge`, `userId`)
- **Constants:** `SCREAMING_SNAKE_CASE` (e.g., `MAX_CONVERSATION_LENGTH`)
- **Private properties:** Prefix with `_` (e.g., `private _client`)

### Types

**Always prefer explicit types over `any`**

```typescript
// Good
interface KnowledgeEntry {
  id: string;
  conversationId: string;
  type: 'problem_solution' | 'insight' | 'decision' | 'learning';
  problem: string;
  context: string;
  solution: string;
  learnings: string[];
  tags: string[];
  embedding?: number[];
  createdAt: Date;
  decayWeight: number;
}

// Bad
const entry: any = { ... };
```

**Use union types for strict variants:**
```typescript
type ConversationStatus = 'active' | 'extracted' | 'archived';
type EntryType = 'problem_solution' | 'insight' | 'decision' | 'learning';
```

### Error Handling

**Always handle errors explicitly**

```typescript
// Good
try {
  const response = await claudeClient.messages.create({ ... });
  return response.content;
} catch (error) {
  if (error instanceof Anthropic.APIError) {
    console.error('Claude API error:', error.status, error.message);
    throw new Error(`Failed to generate response: ${error.message}`);
  }
  throw error;
}

// Bad
const response = await claudeClient.messages.create({ ... });
```

**For async functions, always return rejected promises on error:**
```typescript
async function fetchKnowledge(id: string): Promise<KnowledgeEntry> {
  try {
    const { data, error } = await supabase
      .from('knowledge_entries')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Failed to fetch knowledge entry ${id}:`, error);
    throw error;
  }
}
```

### Async/Await

- Prefer `async/await` over `.then()` chains
- Always use `try/catch` with async operations
- Don't mix async/await with callbacks

### Environment Variables

**Store sensitive data in `.env` (never commit)**

Required variables:
```
TELEGRAM_BOT_TOKEN=
CLAUDE_API_KEY=
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_KEY=
NODE_ENV=development
```

Access via:
```typescript
import dotenv from 'dotenv';
dotenv.config();

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
if (!telegramToken) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}
```

### Database Queries

**Use Supabase client with TypeScript types:**
```typescript
const { data, error } = await supabase
  .from('knowledge_entries')
  .select('*')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: false });

if (error) {
  throw new Error(`Database query failed: ${error.message}`);
}
```

**For vector search:**
```typescript
const { data, error } = await supabase.rpc('match_knowledge', {
  query_embedding: embedding,
  match_threshold: 0.7,
  match_count: 10,
});
```

---

## Architecture Patterns

### Service Layer Pattern

Isolate external API calls in service classes:

```typescript
// src/services/claude.service.ts
export class ClaudeService {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateResponse(conversation: Message[]): Promise<string> {
    // Implementation
  }
}
```

### Repository Pattern for Database

```typescript
// src/repositories/knowledge.repository.ts
export class KnowledgeRepository {
  async save(entry: KnowledgeEntry): Promise<void> { ... }
  async findById(id: string): Promise<KnowledgeEntry | null> { ... }
  async search(embedding: number[]): Promise<KnowledgeEntry[]> { ... }
}
```

---

## Key Implementation Notes

1. **Conversation State:** Track conversation state in memory (simple Map) or database for persistence
2. **Message Batching:** Group messages by time window (e.g., 5 min idle = end of conversation)
3. **Extraction Trigger:** Detect conversation end via timeout or explicit user command
4. **Embeddings:** Generate embeddings only for final extracted knowledge, not every message
5. **Decay Weight:** Start at 1.0, decrease over time (implement in Phase 3+)
6. **Casual Tone:** Claude system prompts should emphasize conversational, non-formal responses

---

## Testing Guidelines

- Write unit tests for services (Claude, OpenAI, Supabase clients)
- Write integration tests for end-to-end conversation flow
- Mock external API calls using jest mocks or test doubles
- Test extraction accuracy with sample conversations
- Coverage target: 80%+ for critical paths

---

## Commit Message Format

```
<type>: <brief description>

<optional detailed explanation>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Examples:
- `feat: add telegram webhook handler`
- `fix: handle claude api rate limiting`
- `refactor: extract conversation state to service`
