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

This project uses the **Thought Model v1** schema:

- **Primary schema (Thought Model v1):** Append-only `thoughts` linked to raw `sources`, with Supabase for storage and vector search.
- **Legacy schema (Phase 1 / Phase 2A):** `conversations` and `knowledge_entries` tables (being migrated).
- **Future:** Markdown vault as human-readable source of truth for portability.

### Legacy schema (Phase 1 / Phase 2A) - Being Migrated

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

-- Knowledge entries extracted from conversations (legacy model)
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

### Primary schema (Thought Model v1) - Active

Notes:
- Thoughts are **append-only**. Updates create a new thought that supersedes the old one.
- Sources preserve full fidelity (raw transcript/article text) while thoughts stay short and composable.
- Code implementation complete; SQL migration pending.

```sql
-- Sources are raw inputs (conversation transcript, article text, research notes)
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    type TEXT NOT NULL, -- conversation | article | research | manual
    title TEXT,
    raw TEXT NOT NULL,
    summary TEXT,
    url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    captured_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Thoughts are atomic, standalone claims derived from sources
CREATE TABLE thoughts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,

    kind TEXT NOT NULL, -- principle | heuristic | decision | lesson | observation | prediction | preference | fact | feeling | goal
    domain TEXT NOT NULL, -- personal | professional | mixed
    privacy TEXT DEFAULT 'private', -- private | sensitive | shareable

    claim TEXT NOT NULL,
    stance TEXT NOT NULL, -- believe | tentative | question | rejected
    confidence FLOAT,

    context TEXT,
    evidence TEXT[],
    examples TEXT[],
    actionables TEXT[],

    tags TEXT[],

    supersedes_id UUID REFERENCES thoughts(id),
    superseded_by_id UUID REFERENCES thoughts(id),
    related_ids UUID[],

    embedding VECTOR(1536),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Many thoughts can be backed by many sources (with optional quoted snippet)
CREATE TABLE thought_sources (
    thought_id UUID REFERENCES thoughts(id) ON DELETE CASCADE,
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    quoted TEXT,
    PRIMARY KEY (thought_id, source_id)
);

-- Optional: search index for thoughts
CREATE INDEX ON thoughts USING ivfflat (embedding vector_cosine_ops);
```

The Markdown vault mirrors the target schema:
- Each thought is written to `vault/thoughts/`
- Each source is written to `vault/sources/`
- Superseding a thought creates a new file; older versions remain

#### Migration Status (Phase 2.5)

**Status:** Schema migrated, deployment pending

The migration from the legacy model to Thought Model v1:

- `conversations` → `sources` where `type = 'conversation'`
- `knowledge_entries` → `thoughts` (type → kind mapping below)

**Completed:**
- ✅ Updated `/extract` to create sources + thoughts
- ✅ Updated `/remember` to create thoughts
- ✅ Updated `/recall` to query thoughts table
- ✅ SQL migration script executed (`scripts/phase-2.5-thought-model.sql`)
- ✅ Existing data migrated (11 conversations → sources, 4 knowledge_entries → thoughts)

**Pending:**
- Deploy updated code to Railway
- Test end-to-end flow

Legacy `knowledge_entries.type` → Thought `kind` mapping:

| Legacy `type` | Thought `kind` |
|--------------|----------------|
| `problem_solution` | `heuristic` (or `lesson` if reflective) |
| `insight` | `observation` |
| `decision` | `decision` |
| `learning` | `lesson` |
| `fact` | `fact` |
| `preference` | `preference` |
| `event` | `fact` (with date in claim/context) |
| `relationship` | `fact` (person-centric; often `context`-heavy) |
| `goal` | `goal` |
| `article_summary` | `observation` (plus store the article as a `source`) |
| `research` | `observation` (plus store the research bundle as a `source`) |

Implementation:
- Clean cutover to new schema (no dual-write)
- SQL migration handles data migration
- Legacy tables will be archived after verification

---

## Thought Model (v1)

The core atomic unit of knowledge in this system is a **thought**.

A **thought** is the smallest durable knowledge object that is:
- Independently retrievable (stands alone in recall results)
- Composable (multiple thoughts can be assembled into frameworks, posts, talks)
- Traceable (links back to sources like conversations/articles)
- Append-only (never edited; only superseded by new versions)

### Definition

A **thought** is a single user-authored claim (or decision/observation/etc.) with optional compact context and traceable sources.

Practical constraint: `claim` should be 1–2 sentences and readable without the original transcript.

### Why “thoughts” (not just raw notes)

- **Framework-driven synthesis** works best on clean, standalone claims.
- **Context is preserved** via linked sources (raw transcript/article text) without bloating the thought itself.
- **History matters**: thoughts evolve. We keep a revision chain rather than overwriting.

### Thought v1 fields (recommended)

Required:
- `id` (UUID)
- `created_at`, `updated_at`
- `kind` (enum): `principle | heuristic | decision | lesson | observation | prediction | preference | fact | feeling | goal`
- `domain` (enum): `personal | professional | mixed`
- `claim` (string; 1–2 sentences; standalone)
- `stance` (enum): `believe | tentative | question | rejected`
- `tags` (string[])
- `sources` (array): `{ type: conversation | article | research | manual, ref: string, url?: string }`

Strongly recommended:
- `context` (string; short bullets; “when/where this applies”)
- `evidence` (string[]; bullets)
- `examples` (string[]; bullets)
- `actionables` (string[]; bullets)
- `confidence` (0–1)
- `privacy` (enum): `private | sensitive | shareable`
- `supersedes_id` (UUID | null)
- `superseded_by_id` (UUID | null) — convenience pointer
- `related_ids` (UUID[]) — for clustering into frameworks

### Append-only revision rule

Thoughts are immutable. Any change creates a new thought that supersedes the old one:
- New thought sets `supersedes_id`
- Old thought sets `superseded_by_id`
- Retrieval defaults to the latest version unless history is requested

### Source model (to preserve full context)

To avoid losing richness (especially for story context), store **sources** separately from thoughts:

- `Source` types: `conversation | article | research | manual`
- Fields: `id`, `type`, `captured_at`, `title`, `raw`, optional `summary`, optional `metadata` (url, author, chat id, etc.)

A conversation/article can yield **1–N thoughts**.

### Markdown / Obsidian support (early)

To avoid vendor lock-in and improve glanceability, persist thoughts and sources as Markdown files (Obsidian-friendly) early:

- `vault/thoughts/YYYY/MM/<id>-<slug>.md`
- `vault/sources/YYYY/MM/<source-id>-<slug>.md`

Supabase remains useful as an indexing/search backend initially, but Markdown files provide portability and human-readable browsing.

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

| Practice | Industry Standard | Our Current Approach |
|----------|------------------|----------------------|
| Search | Hybrid: BM25 + vector + reranking | ✅ Hybrid: Full-text + vector + RRF |
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

**Limitation discovered:** Claude Agent SDK is **Claude-only** and requires **API credits** (not Pro/Max subscription). No support for OpenRouter, OpenAI, or other providers.

#### 5. Clawdbot Codebase Analysis

We obtained access to the [Clawdbot](https://github.com/nicosql/clawdbot) codebase (MIT licensed) and conducted a deep analysis:

| Aspect | Finding |
|--------|---------|
| **Stack** | TypeScript, Node 22+, pnpm monorepo, ~100K LOC |
| **License** | MIT - fully permissive |
| **Architecture** | Monolithic gateway, custom WebSocket protocol |
| **Agent Framework** | [pi-agent](https://www.npmjs.com/package/@mariozechner/pi-ai) by Mario Zechner |
| **Multi-channel** | Telegram, WhatsApp, Discord, iMessage, Signal, WebChat |
| **Knowledge** | External skills (QMD, Obsidian) - loosely coupled |
| **Skills** | 47 bundled CLI wrappers with SKILL.md metadata |
| **Generalizability** | ~80% reusable, ~20% macOS/Peter-specific |

**Key insight:** Clawdbot is a general-purpose AI assistant with excellent multi-channel routing. However, it does NOT have built-in knowledge extraction workflows - that's our unique value proposition.

#### 6. Pi-Agent vs Claude Agent SDK

Critical discovery: Clawdbot uses **pi-agent**, which supports multiple model providers unlike Claude Agent SDK.

| Aspect | Pi-Agent (Clawdbot uses) | Claude Agent SDK |
|--------|--------------------------|------------------|
| **Model Providers** | ✅ Multi: Anthropic, OpenAI, Google, OpenRouter, Groq, Cerebras, xAI, Ollama | ❌ Claude only |
| **Pricing Flexibility** | ✅ Use OpenRouter free models, any provider | ❌ Claude API credits only |
| **Pro/Max Subscription** | ❌ No (API-based) | ❌ No (API-based) |
| **Built-in Tools** | ❌ None - you build or use skills | ✅ Read, Write, Edit, Glob, Grep, WebSearch |
| **MCP Support** | ❌ Custom protocol | ✅ Native MCP |
| **Cross-provider Handoff** | ✅ Can switch models mid-conversation | ❌ N/A (single provider) |
| **Tool Calling** | ✅ TypeBox schemas | ✅ Native |

**Sources:**
- [Pi-Agent Blog Post](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)
- [@mariozechner/pi-ai on npm](https://www.npmjs.com/package/@mariozechner/pi-ai)

#### 7. Core Value Proposition Clarification

Through this research, we clarified what we're actually building:

```
┌─────────────────────────────────────────────────────────┐
│           OUR UNIQUE VALUE (Second Brain)               │
│                                                          │
│  • Conversational knowledge extraction                  │
│  • Structured capture (problem/solution/learnings)      │
│  • Semantic recall of YOUR experiences                  │
│  • Profile building → Content synthesis                 │
│  • Knowledge decay, contradiction detection             │
│  • "What do I uniquely know about X?"                   │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │ Built on top of
                         │
┌─────────────────────────────────────────────────────────┐
│           COMMODITY LAYER (AI Agent + Tools)            │
│                                                          │
│  Options:                                               │
│  • Claude Agent SDK (best DX, locked to Claude)        │
│  • Pi-Agent (model flexibility, more setup)            │
│  • Clawdbot fork (47 skills, but 100K LOC)             │
│  • Current custom approach (full control, most work)   │
└─────────────────────────────────────────────────────────┘
```

**Key insight:** Clawdbot, Claude Agent SDK, and similar tools solve the "AI agent with tools" layer. Our unique value is the **knowledge extraction and synthesis workflow** on top - that doesn't exist elsewhere.

### Comparative Analysis

#### What We Got Right
- ✅ Telegram as interface (mobile-first, always accessible)
- ✅ Conversational extraction (the core idea is sound)
- ✅ Structured extraction with LLM (problem/solution/learnings)
- ✅ Working, deployed, production system

#### What We Over-Engineered
- ❌ **Custom database schema** - knowledge locked in Postgres, not easily browsable
- ❌ **Supabase dependency** - migration is painful if we want to switch
- ✅ ~~**Vector-only search**~~ - Hybrid search (BM25 + vector + RRF) now implemented
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

### Decision Status: RESOLVED (January 5, 2026)

**Decision:** Move forward with **Claude Agent SDK** for agentic capabilities.

**Rationale:**
- Velocity > model flexibility (for now)
- Daily usage is expected to be moderate; budget around **~$1/day** token costs

**Storage decision:** Implement **Markdown/Obsidian-compatible storage** for portability (deferred to after Phase 2.5 core migration).

**Fallback plan:** If Claude costs become painful, migrate to pi-agent later while keeping the same thought/source storage model.

**Current Phase 2.5 Status:**
- ✅ Thought Model v1 schema implemented
- ✅ Code updated for new schema
- ✅ SQL migration complete
- ✅ Deployed to Railway
- ✅ End-to-end flow verified
- ✅ Hybrid search implemented and verified (vector + full-text with RRF)
- ⏳ Claude Agent SDK integration (next priority)

---

### Architecture Options Considered

<details>
<summary>Click to expand architecture options analysis</summary>

#### Option A: Claude Agent SDK (CHOSEN)
```
Pros:
+ Best developer experience
+ Built-in tools (Read, Write, Grep, WebSearch, etc.)
+ Native MCP support
+ Same capabilities as Claude Code CLI

Cons:
- Claude-only (no OpenRouter, no GPT-4, no local models)
- Requires API credits (can't use Pro/Max subscription)
- Higher cost for heavy usage
- Vendor lock-in
```

#### Option B: Pi-Agent (fresh build)
```
Pros:
+ Multi-provider (Anthropic, OpenAI, Google, OpenRouter, Ollama, etc.)
+ Cost flexibility (use free/cheap models via OpenRouter)
+ Cross-provider context handoff
+ Battle-tested (powers Clawdbot)

Cons:
- No built-in tools (need to build or port)
- More setup work
- Custom protocol (not MCP)
```

#### Option C: Fork Clawdbot
```
Pros:
+ 47 skills ready to use
+ Multi-channel already built (Telegram, WhatsApp, Discord, etc.)
+ Pi-agent foundation (model flexibility)
+ Production-grade, MIT licensed

Cons:
- ~100K LOC to understand and maintain
- 20% macOS/Peter-specific code to remove
- Monolithic architecture
- No knowledge extraction workflow (our unique value)
```

#### Option D: Continue Current Approach
```
Pros:
+ Already working and deployed
+ Full control over architecture
+ Uses OpenRouter (model flexibility)
+ Smallest codebase (~2K LOC)

Cons:
- No agentic reasoning (single LLM calls)
- Manual tool orchestration
- More work for new features
```

#### Comparison Matrix

| Factor | Claude SDK | Pi-Agent | Clawdbot Fork | Current |
|--------|-----------|----------|---------------|---------|
| Model flexibility | ❌ | ✅ | ✅ | ✅ |
| Built-in tools | ✅ | ❌ | ⚠️ Skills | ❌ |
| Setup effort | Low | Medium | High | Done |
| Maintenance | Low | Medium | High | Medium |
| Cost control | ❌ | ✅ | ✅ | ✅ |
| Agentic reasoning | ✅ | ✅ | ✅ | ❌ |
| Our unique value | Build on top | Build on top | Build on top | Built-in |

#### Key Question Resolved

> **Is model flexibility worth giving up Claude Agent SDK's built-in tools?**

**Answer:** No, for now. Velocity is the priority. Claude Agent SDK chosen.

</details>

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
2. Add Markdown vault persistence for thoughts + sources (Obsidian-friendly)
3. Build new features (Phase 2B `/read`, Phase 2C `/research`) with SDK
4. Validate SDK approach works well
5. Gradually migrate existing features (`/recall`, `/remember`)
6. Keep Supabase as optional index/search backend

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

### Phase 2.5: Foundation Migration 🚧 **IN PROGRESS**
**Goal:** Migrate to Thought Model v1 for better knowledge structure

**Status:** Schema migrated, deployment pending

**Decision (Jan 5, 2026):** Claude Agent SDK chosen for velocity. ~$1/day token budget.

**Completed:**
- [x] Thought Model v1 types and interfaces
- [x] New extraction prompt (multi-thought output)
- [x] New categorization prompt for `/remember`
- [x] ThoughtRepository and SourceRepository
- [x] SupabaseService methods for thoughts/sources
- [x] Updated `/extract`, `/remember`, `/recall` handlers
- [x] SQL migration executed in Supabase
- [x] Existing data migrated
- [x] Deployed to Railway
- [x] End-to-end flow verified
- [x] Hybrid search implemented (vector + full-text with RRF)

**Hybrid Search Implementation:**
- SQL migration (`scripts/hybrid-search-migration.sql`):
  - Added `search_vector` (tsvector) column to thoughts table
  - Created GIN index for full-text search
  - Auto-populate trigger for search_vector on insert/update
  - Weighted tsvector fields: A=claim, B=context, C=tags/actionables/evidence
  - `hybrid_match_thoughts` SQL function using RRF (k=60)
- Code changes:
  - `SupabaseService`: Added `HybridSearchOptions`, `HybridThoughtSearchResult`, `hybridSearchThoughts()`
  - `ThoughtRepository`: Added `ThoughtSearchOptions`, `hybridSearch()`
  - `TelegramHandler`: Updated `handleRecall()` with filter parsing, hybrid search usage
- New `/recall` features:
  - Supports `--kind=TYPE` filter (e.g., `--kind=heuristic`)
  - Supports `--tag=TAG` filter (e.g., `--tag=debugging`)
  - Shows text match indicator (📝) when full-text contributed
  - 25% minimum similarity threshold to filter noise
  - Markdown escaping for special characters in output

**Pending:**
- [ ] Implement Markdown vault persistence (deferred)

### Phase 2B: Article Ingestion
**Goal:** Ingest and summarize web articles
**Implementation:** Claude Agent SDK with WebFetch

- [ ] `/read [url]` command
- [ ] Web page fetching and content extraction
- [ ] LLM summarization of article content
- [ ] Store as `observation` thought with article as `source`
- [ ] Handle common article formats (blogs, docs, news)

### Phase 2C: Web Research
**Goal:** Research topics and compile findings
**Implementation:** Claude Agent SDK with WebSearch + WebFetch

- [ ] `/research [topic]` command
- [ ] Web search integration (SDK WebSearch or Google Custom Search)
- [ ] Multi-step: search → fetch top results → synthesize
- [ ] Auto-save as `observation` thought with research as `source`
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
