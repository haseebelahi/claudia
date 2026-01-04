# Personal Knowledge Assistant - MVP

## Vision

An active knowledge extraction assistant that lives in a chat platform, mirrors your communication style, and helps you capture what you've *learned* (not just what you've seen).

## Two Layers

### Passive Layer (what you've seen)
- Browser history, bookmarks, GitHub code
- Ingested via batch sync
- Time decay for freshness
- *Deferred to post-MVP*

### Active Layer (what you've learned)
- Conversations where the system extracts problem→solution pairs
- Auto-structured for retrieval
- *This is the MVP focus*

## Interaction Model

- Lives in Telegram (or Slack/Discord)
- Fully reactive + optional notifications for scheduled check-ins
- Casual conversation tone that learns your voice over time

## Use Cases

### MVP
- Knowledge extraction through conversation
- Direct query ("what do I know about X")

### Post-MVP
- Contextual push (you set explicit context, it surfaces relevant knowledge)
- Synthesis on demand (LinkedIn posts, blog drafts, talk outlines)
- Decision support, learning gap analysis, pattern matching
- Passive data ingestion (browser history, GitHub, bookmarks)

## Quality Control

- Post-conversation ratings
- Periodic curation sessions
- Time decay for staleness
- Self-rating for suggestions

---

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Chat Interface | Telegram Bot | Simple API, mobile + desktop, free |
| LLM | OpenRouter (model-agnostic) | Flexible - can use Claude, GPT-4, Mistral, etc. via Vercel AI SDK |
| Database | Supabase (Postgres + pgvector) | Free tier, built-in vector search, managed |
| Embeddings | OpenAI text-embedding-3-small | Cheap, good quality |
| Hosting | Railway.app | $5/month free tier, perfect for long-running bots |

---

## Data Model

```sql
-- Conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT, -- Telegram user ID for multi-user support
    started_at TIMESTAMP DEFAULT NOW(),
    raw_transcript TEXT,
    status TEXT DEFAULT 'active', -- active | extracted | archived
    quality_rating INTEGER, -- null | 1-5, user rates after
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge entries extracted from conversations
CREATE TABLE knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    type TEXT, -- problem_solution | insight | decision | learning | fact | preference | event | relationship | goal | article_summary | research
    problem TEXT,
    context TEXT,
    solution TEXT,
    learnings TEXT[], -- array of key takeaways
    tags TEXT[], -- auto-generated
    embedding VECTOR(1536), -- for text-embedding-3-small
    created_at TIMESTAMP DEFAULT NOW(),
    decay_weight FLOAT DEFAULT 1.0 -- decreases over time
);

-- Activity signals (post-MVP - passive layer)
CREATE TABLE activity_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT, -- browser | github | twitter | manual
    content TEXT,
    url TEXT,
    embedding VECTOR(1536),
    captured_at TIMESTAMP DEFAULT NOW()
);

-- Enable vector similarity search
CREATE INDEX ON knowledge_entries USING ivfflat (embedding vector_cosine_ops);
```

---

## Knowledge Types

The system supports multiple knowledge entry types beyond problem/solution pairs:

| Type | Description | Input Method |
|------|-------------|--------------|
| `problem_solution` | Debugging stories, fixes, workarounds | Conversation + `/extract` |
| `insight` | Realizations, "aha" moments | Conversation + `/extract` |
| `decision` | Choices made with rationale | Conversation + `/extract` |
| `learning` | General learnings, takeaways | Conversation + `/extract` |
| `fact` | Quick facts, dates, numbers | `/remember` |
| `preference` | Personal preferences (tools, airlines, etc.) | `/remember` |
| `event` | Important dates (birthdays, anniversaries) | `/remember` |
| `relationship` | People and context about them | `/remember` |
| `goal` | Things you're working toward | `/remember` |
| `article_summary` | Summarized web articles | `/read [url]` |
| `research` | Compiled research from web search | `/research [topic]` |

---

## Conversation Flow

```
You: "hey, just spent 3 hours debugging something annoying"

Bot: "oh nice, what was the rabbit hole?"

You: "kubernetes pod kept getting OOMKilled even though
      memory limit was set way higher than actual usage"

Bot: "classic. what ended up being the issue?"

You: "turns out the JVM was ignoring container limits,
      had to set -XX:+UseContainerSupport explicitly"

Bot: "that's a good one. was this on a specific JVM version
      or cluster setup that made it worse?"

You: "yeah, older JVM image. upgraded to 17 and it
      worked out of the box actually"

Bot: "got it. so the real fix was JVM upgrade, the flag
      was the debugging clue. anything you'd do
      differently next time?"

You: "check JVM version first when memory stuff is weird"

Bot: "solid. I've captured this - K8s memory debugging,
      JVM container awareness, the version gotcha.
      want me to read it back or we good?"

You: "we good"

[Bot extracts and stores structured knowledge entry]
```

---

## System Prompts

The assistant is **self-aware** - it knows what it is, your background, and the project goals.

### Conversation Mode
The bot knows:
- It's a personal knowledge extraction assistant built for an 8+ year SWE
- Tech stack: Telegram, OpenRouter/Claude, OpenAI embeddings, Supabase
- Your interests: Tech, science, personal finance, investing
- Its purpose: Extract learnings for future retrieval and synthesis
- That you're actively building it (meta-awareness!)

Full prompts in `src/services/llm.service.ts` and documented in [docs/architecture/SYSTEM_PROMPTS.md](docs/architecture/SYSTEM_PROMPTS.md)

### Extraction Mode
Extracts structured knowledge with:
- Type classification (see Knowledge Types section above)
- Concise problem/solution statements (for applicable types)
- 2-5 actionable learnings
- 3-7 relevant tags (lowercase, underscored)
- Full context for future semantic search
- Auto-categorization with user confirmation for `/remember` entries

---

## Estimated Costs (MVP)

| Service | Monthly Cost |
|---------|--------------|
| Supabase | $0 (free tier) |
| Railway.app | $0 (free $5 credit/month) |
| OpenRouter (LLM) | $2-5 |
| OpenAI Embeddings | $1-2 |
| **Total** | **~$3-7/month** |

---

## Design Decisions (from interview)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Temporal relevance | Decay model | Technical knowledge gets stale |
| Depth signal | Engagement proxies | Time spent, return visits indicate comprehension |
| Content authenticity | Authentic + framing | Your knowledge, platform-appropriate presentation |
| Code signal | All code counts | Even boilerplate choices reflect knowledge |
| Privacy | Full inclusion | Personal knowledge is still knowledge |
| Narrative extraction | Conversation mode | System interviews to extract stories |
| Cold start | Months of history | Plan to backfill historical data |
| Infrastructure | Managed simple | Supabase/Pinecone style, minimal ops |
| Sync freshness | Batch is fine | Weekly/manual syncs acceptable |
| Interaction overhead | Flexible | Start minimal, increase if valuable |
| Output format | Full outline | Detailed outputs for talks/posts |
| Correction model | Negative signal | Downweight but preserve history |
| Personas | Platform-aware | Same knowledge, tailored per platform |
| Conflict handling | Ask user | Clarify current stance when detected |
| Interface | Chat | Conversational UI in Telegram/Slack |
| Knowledge storage | Auto-structured | Extract problem/solution/learnings automatically |
| Source blending | Unified | Seamlessly blend, don't distinguish to user |
| Quality control | Rating + curation | Both active signals for quality |
| Context awareness | Explicit | User declares current context |
| Personality | Mirror of user | Learns communication style over time |
| Proactive messaging | Notifications OK | Can ping, user not obligated to respond |
| Agency | Drafts for review | Prepares content, user always reviews |
| Style learning | From conversations | Gradual organic learning |
| Longevity | Core infrastructure | Built for 10+ years |
| Budget | $20-50/month | Moderate investment |
| Build approach | Mostly assemble | Stitch existing tools together |
| First milestone | Extraction works | One good knowledge conversation |
| Quick knowledge input | `/remember` command | Bypass conversation for simple facts |
| Category confirmation | Bot confirms | Reduces silent misclassification |
| Search API | Google Custom Search | Free tier (100/day) sufficient for personal use |
| Research depth | Shallow v1 | Top 3 results, fast and cheap |
| Research storage | Always save | No prompt needed, automatic |
| Multi-user | Deprioritized | Single user focus for now |

---

## Architectural Research & Evolution (January 2026)

After completing Phase 1 and 2A, we paused to evaluate whether our current architecture was optimal. This section documents the research, analysis, and decisions made.

### The Question

> "Are we building custom infrastructure that existing tools already provide better?"

### Research Conducted

#### 1. Clawd.me Analysis
[Clawd](https://clawd.me/) is a personal AI assistant running on Claude Opus 4.5 with these architectural choices:

| Component | Clawd's Approach |
|-----------|------------------|
| **Hosting** | Local Mac Studio (full data sovereignty) |
| **Search** | QMD: Hybrid BM25 + vector embeddings + LLM reranking via Ollama |
| **Knowledge Store** | Obsidian vault (markdown files) |
| **Interfaces** | Multi-channel: WhatsApp, Telegram, Discord, iMessage aggregated |
| **Integrations** | Gmail, Calendar, Things 3, smart home, image generation |

**Key insight:** Clawd uses Obsidian as the source of truth, not a database. The LLM is a layer on top of human-readable markdown files.

#### 2. Obsidian-Claude-PKM Analysis
[obsidian-claude-pkm](https://github.com/ballred/obsidian-claude-pkm) takes a radically simpler approach:

| Component | Approach |
|-----------|----------|
| **Backend** | None - just Obsidian vault + Claude Code CLI |
| **Storage** | Plain markdown files |
| **AI Interface** | Slash commands and specialized agents |
| **Sync** | Git for version control |
| **Setup time** | ~15 minutes |

**Key insight:** No database, no deployment, no API costs beyond Claude. Knowledge is portable, human-readable, and fully owned.

#### 3. Industry Best Practices (2026)

From research on PKM + AI architectures:

| Practice | Industry Standard | Our Original Approach |
|----------|------------------|----------------------|
| Search | Hybrid: BM25 + vector + reranking | Vector only (pgvector) |
| Storage | Human-readable files (markdown) | Structured Postgres tables |
| Portability | Git-versioned, exportable | Locked in Supabase |
| Complexity | Simpler = better | Custom bot + DB + hosting |
| Privacy | Local-first preferred | Cloud-first |

**Sources:**
- [Decoding ML - Second Brain AI Course](https://decodingml.substack.com/p/build-your-second-brain-ai-assistant)
- [Building PKM with AI - Buildin.AI](https://buildin.ai/blog/personal-knowledge-management-system-with-ai)
- [Wisdom Engine for PKM](https://asksensay.medium.com/implementing-a-wisdom-engine-for-personal-knowledge-management-3c76b8d8f760)

#### 4. Claude Agent SDK Discovery

The [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents-and-tools/claude-agent-sdk) provides:

- **Same capabilities as Claude Code CLI** as a programmable library
- **Built-in tools:** Read, Write, Edit, Glob, Grep, WebSearch, WebFetch, Bash
- **MCP (Model Context Protocol):** Clean integration with external systems
- **Session management:** Conversation persistence across exchanges
- **Subagents:** Spawn specialized agents for complex tasks
- **Available in TypeScript:** `npm install @anthropic-ai/claude-agent-sdk`

**Key insight:** The SDK handles the entire tool execution loop autonomously - exactly what we built manually in 1500+ lines of code.

### Comparative Analysis

#### What We Got Right
- ✅ Telegram as interface (mobile-first, always accessible)
- ✅ Conversational extraction (the core idea is sound)
- ✅ Structured extraction with LLM (problem/solution/learnings)
- ✅ Working, deployed, production system

#### What We Over-Engineered
- ❌ **Custom database schema** - knowledge locked in Postgres, not easily browsable
- ❌ **Supabase dependency** - migration is painful if we want to switch
- ❌ **Vector-only search** - missing BM25 for exact keyword matches
- ❌ **No human-readable layer** - can't just open a file and see knowledge
- ❌ **Manual tool orchestration** - SDK provides this for free

#### Architecture Comparison

| Aspect | Current (Custom Bot) | Obsidian + Claude Code | Agent SDK + MCP |
|--------|---------------------|------------------------|-----------------|
| **Complexity** | Medium (custom code) | Low (files + CLI) | Low-Medium (SDK handles loop) |
| **Storage** | Postgres tables | Markdown files | Your choice |
| **Agentic reasoning** | Single LLM call | Claude Code orchestrates | SDK orchestrates |
| **Multi-step tasks** | We orchestrate | Claude Code does it | SDK does it |
| **Telegram support** | ✅ Built-in | ❌ Poor | ✅ Via MCP |
| **Mobile access** | ✅ Great | ❌ Poor | ✅ Via MCP |
| **Knowledge portability** | ❌ Locked in DB | ✅ Git-versioned | ✅ If using files |
| **Built-in tools** | None | Full suite | Full suite + custom MCP |

### The Decision: Hybrid Migration to Agent SDK

**Decision Date:** January 4, 2026

**Choice:** Hybrid migration - keep current bot running while building Agent SDK version in parallel.

**Reasoning:**

1. **Risk mitigation:** Current bot is working and deployed. Don't break what works.
2. **Incremental validation:** Test SDK on new features before touching working code.
3. **TypeScript compatibility:** SDK available in TypeScript, can reuse existing code.
4. **Best of both worlds:** Keep Telegram (mobile), add SDK power (agentic reasoning).
5. **Storage flexibility:** Can experiment with markdown files vs. database during migration.
6. **Easy rollback:** If SDK has issues, fall back to direct implementation.

**What changes:**
- New features (Phase 2B, 2C, 4) built with Agent SDK
- Existing services wrapped as MCP servers
- Gradual migration of existing features once SDK is proven
- Option to add markdown file storage alongside or instead of Supabase

### Target Architecture (Post-Migration)

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Agent SDK                      │
│                  (ClaudeSDKClient)                       │
│                                                          │
│  Built-in tools:          Your MCP servers:             │
│  ├── Read                 ├── telegram (send/receive)   │
│  ├── Write                ├── knowledge (semantic search)│
│  ├── Edit                 └── future: calendar, etc.    │
│  ├── Glob                                               │
│  ├── Grep                                               │
│  ├── WebSearch                                          │
│  ├── WebFetch                                           │
│  └── Task (subagents)                                   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Knowledge Storage (Hybrid)                  │
│                                                          │
│  Option A: Keep Supabase (wrap as MCP)                  │
│  Option B: Markdown files + vector index                │
│  Option C: Both (files as source, DB for search)        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Sync & Access                          │
│                                                          │
│  Git → GitHub → Obsidian (browse/edit on any device)   │
│  Telegram MCP → mobile input/output                     │
└─────────────────────────────────────────────────────────┘
```

### Migration Strategy

**Phase 2.5: Agent SDK Integration (NEW)**

```
src/
├── ... (existing code - untouched initially)
└── agent/                      # NEW: Agent SDK layer
    ├── index.ts                # SDK client setup
    ├── mcp/
    │   ├── telegram.mcp.ts     # Wrap existing Telegram handler
    │   ├── knowledge.mcp.ts    # Wrap existing Supabase service
    │   └── index.ts
    └── prompts/
        └── CLAUDE.md           # System prompt for agent
```

**Migration Order:**
1. Build SDK foundation with MCP wrappers for existing services
2. Build new features (Phase 2B `/read`, Phase 2C `/research`) with SDK
3. Validate SDK approach works well
4. Gradually migrate existing features (`/recall`, `/remember`)
5. Optionally add markdown file storage

---

## Implementation Roadmap

### Phase 1: Core Extraction Loop (MVP - "Extraction Works") ✅ **COMPLETE**
**Goal:** You can have a conversation, bot extracts and saves knowledge

**Setup & Infrastructure:**
- [x] Telegram bot created via BotFather
- [x] Supabase project created
- [x] OpenRouter API key obtained (using Vercel AI SDK for flexibility)
- [x] OpenAI API key obtained (for embeddings)
- [x] Supabase database tables created (conversations, knowledge_entries, activity_signals)
- [x] User ID column added for multi-user support
- [x] Project scaffold (TypeScript/Node)
- [x] Environment configuration with dotenv

**Core Functionality:**
- [x] Telegram bot handler with message handling
- [x] LLM integration for conversation mode (via Vercel AI SDK + OpenRouter)
- [x] Conversation state tracking (in-memory with DB persistence)
- [x] Auto-save conversation on every message
- [x] Conversation persistence across server restarts (lazy-loading)
- [x] Extraction trigger (`/extract` command)
- [x] Structured knowledge extraction → storage with embeddings
- [x] OpenAI embeddings generation for semantic search

**Bot Commands:**
- [x] `/status` - Show conversation status
- [x] `/new` - Start new conversation (prompts to extract/clear existing)
- [x] `/extract` - Save knowledge with embeddings
- [x] `/clear` - Discard conversation and start fresh

**Advanced Features:**
- [x] Self-aware system prompts (knows project context, your background)
- [x] Multi-user support (isolated conversations per Telegram user)
- [x] Conversation timeout (5 min configurable)
- [x] Graceful error handling

**Deployment:**
- [x] Deployed to Railway.app
- [x] Running 24/7 in production
- [x] Auto-deploy on git push
- [x] Environment variables configured

**Documentation:**
- [x] README.md - Project overview and quick start
- [x] TODO.md - Roadmap with status
- [x] USAGE.md - User guide with all commands
- [x] docs/development/AGENTS.md - Guidelines for AI coding agents
- [x] docs/development/SETUP.md - Development setup instructions
- [x] docs/development/LOCAL_TESTING.md - Local testing guide
- [x] docs/deployment/DEPLOYMENT.md - Deployment guide (5+ platforms)
- [x] docs/deployment/POST_DEPLOYMENT_CHECKLIST.md - Verification steps
- [x] docs/architecture/CONVERSATION_MANAGEMENT.md - Conversation lifecycle
- [x] docs/architecture/CONVERSATION_PERSISTENCE.md - Restart behavior
- [x] docs/architecture/SYSTEM_PROMPTS.md - Self-awareness documentation

**Status:** 🟢 **LIVE IN PRODUCTION**

### Phase 2: Retrieval & Expanded Input
**Goal:** Query knowledge, quick-add facts, and ingest external content

#### Phase 2A: Retrieval & Quick Storage ✅ **COMPLETE**
- [x] `/recall [topic]` command with semantic search
- [x] Generate embedding for search query
- [x] Relevance ranking and result formatting
- [x] `/remember [fact]` command for quick fact storage
- [x] Auto-categorization (fact, preference, event, relationship, goal)
- [x] Category confirmation with correction option
- [ ] Decay weight in retrieval scoring (deferred)

### Phase 2.5: Agent SDK Migration 🔄 **IN PROGRESS**
**Goal:** Introduce Claude Agent SDK for more powerful agentic capabilities

**Decision documented:** See "Architectural Research & Evolution" section above.

#### Step 1: SDK Foundation
- [ ] Install `@anthropic-ai/claude-agent-sdk`
- [ ] Create `src/agent/` directory structure
- [ ] Basic SDK client setup with session management
- [ ] Test simple query/response flow

#### Step 2: MCP Server Wrappers
- [ ] Create `telegram.mcp.ts` - wrap existing Telegram send/receive
- [ ] Create `knowledge.mcp.ts` - wrap Supabase search/store operations
- [ ] Register MCP servers with SDK client
- [ ] Test tool invocation through SDK

#### Step 3: Build New Features with SDK
- [ ] `/read [url]` - use SDK's WebFetch + custom extraction
- [ ] `/research [topic]` - use SDK's WebSearch + multi-step synthesis
- [ ] Validate agentic reasoning improves these features

#### Step 4: Gradual Migration (Optional)
- [ ] Route `/recall` through SDK (compare quality)
- [ ] Route `/remember` through SDK (compare quality)
- [ ] Evaluate: keep dual-path or fully migrate?

#### Step 5: Storage Evolution (Optional)
- [ ] Experiment with markdown file storage
- [ ] Add Git integration for version control
- [ ] Evaluate hybrid: files as source, DB for vector search

**Status:** 🟡 **PLANNED - Starting after research phase**

### Phase 2B: Article Ingestion (via Agent SDK)
- [ ] `/read [url]` command (built with SDK)
- [ ] SDK's WebFetch for content extraction
- [ ] LLM summarization with agentic reasoning
- [ ] Store as `article_summary` type via knowledge MCP
- [ ] Handle common article formats (blogs, docs, news)

### Phase 2C: Web Research (via Agent SDK)
- [ ] `/research [topic]` command (built with SDK)
- [ ] SDK's WebSearch for discovery
- [ ] Multi-step: search → fetch top results → synthesize
- [ ] Auto-save as `research` type via knowledge MCP
- [ ] Source attribution in stored entry

### Phase 3: Profile Building
**Goal:** Build rich context about you for future synthesis

- [ ] Organic conversations about background, career, projects
- [ ] Extract as profile knowledge entries
- [ ] Store work history, achievements, key projects
- [ ] Capture professional opinions and takes
- [ ] Foundation for LinkedIn/blog synthesis

### Phase 4: Synthesis
**Goal:** Generate content drafts from your knowledge

- [ ] `/draft linkedin [topic]` - pull relevant knowledge, generate post draft
- [ ] `/draft blog [topic]` - longer form content generation
- [ ] Style learning from provided examples (paste posts you liked)
- [ ] Platform-aware framing in outputs
- [ ] Iterative refinement through conversation

### Phase 5: Life Coordinator
**Goal:** Help plan and track personal life

- [ ] Planning mode for events/trips
- [ ] Proactive suggestions (scheduled jobs, weekend prompts)
- [ ] State tracking (visited, completed, to-do lists)
- [ ] Deep research mode (top 10 results + follow promising links)
- [ ] Reminder system for important dates/events

### Phase 6: Integrations (Future)
**Goal:** Connect to external systems

- [ ] Calendar integration (Google Calendar, etc.)
- [ ] Passive layer ingestion (browser history, GitHub, bookmarks)
- [ ] Activity spike detection and prompts
- [ ] Export/backup functionality
