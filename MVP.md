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

#### Phase 2A: Retrieval & Quick Storage
- [ ] `/recall [topic]` command with semantic search
- [ ] Generate embedding for search query
- [ ] Relevance ranking and result formatting
- [ ] `/remember [fact]` command for quick fact storage
- [ ] Auto-categorization (fact, preference, event, relationship, goal)
- [ ] Category confirmation with correction option
- [ ] Decay weight in retrieval scoring

#### Phase 2B: Article Ingestion
- [ ] `/read [url]` command
- [ ] Web page fetching and content extraction
- [ ] LLM summarization of article content
- [ ] Optional extraction to knowledge base as `article_summary` type
- [ ] Handle common article formats (blogs, docs, news)

#### Phase 2C: Web Research
- [ ] `/research [topic]` command
- [ ] Google Custom Search API integration (free tier: 100/day)
- [ ] Fetch and parse top 3 search results
- [ ] LLM compilation of findings
- [ ] Auto-save as `research` type knowledge entry
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
