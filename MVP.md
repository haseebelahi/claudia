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
- Fully reactive + optional notifications for activity spikes and scheduled check-ins
- Casual conversation tone that learns your voice over time
- Actively challenges you on contradictions and blind spots

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
| LLM | Claude API (Anthropic) | Good at conversation, strong structured extraction |
| Database | Supabase (Postgres + pgvector) | Free tier, built-in vector search, managed |
| Embeddings | OpenAI text-embedding-3-small | Cheap, good quality |
| Hosting | Vercel or Railway | Free tier, handles webhooks |

---

## Data Model

```sql
-- Conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    type TEXT, -- problem_solution | insight | decision | learning
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

### Conversation Mode
```
You are a knowledge extraction assistant that mirrors the user's
casual communication style. Your job is to help them articulate
what they learned from recent experiences.

- Be conversational, not formal
- Ask follow-up questions to get clarity on: the problem,
  what they tried, what worked, and what they'd do differently
- Don't be annoying - 2-3 follow-ups max, then wrap up
- When the conversation feels complete, confirm you've captured it
```

### Extraction Mode
```
Extract structured knowledge from this conversation.

Return JSON:
{
  "type": "problem_solution" | "insight" | "decision" | "learning",
  "problem": "one sentence problem statement",
  "context": "what they were working on",
  "solution": "what resolved it",
  "learnings": ["key takeaway 1", "key takeaway 2"],
  "tags": ["kubernetes", "jvm", "memory", "debugging"]
}
```

---

## Estimated Costs (MVP)

| Service | Monthly Cost |
|---------|--------------|
| Supabase | $0 (free tier) |
| Claude API | $5-15 |
| OpenAI Embeddings | $1-2 |
| Vercel | $0 (free tier) |
| **Total** | **~$10-20/month** |

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
| Challenges | Active | Surface contradictions and blind spots |
| Budget | $20-50/month | Moderate investment |
| Build approach | Mostly assemble | Stitch existing tools together |
| First milestone | Extraction works | One good knowledge conversation |

---

## Implementation Roadmap

### Phase 1: Core Extraction Loop (MVP - "Extraction Works")
**Goal:** You can have a conversation, bot extracts and saves knowledge

- [x] Telegram bot created via BotFather
- [x] Supabase project created
- [x] OpenRouter API key obtained (using Vercel AI SDK for flexibility)
- [x] OpenAI API key obtained (for embeddings)
- [x] Supabase database tables created
- [x] Project scaffold (TypeScript/Node)
- [x] Telegram bot handler with message handling
- [x] LLM integration for conversation mode (via Vercel AI SDK + OpenRouter)
- [x] Message persistence (track conversation state in-memory)
- [x] Extraction trigger (`/extract` command)
- [x] Structured knowledge extraction → storage with embeddings
- [x] Basic `/status` command to confirm it's working
- [ ] Install Node.js and dependencies
- [ ] Configure `.env` with API keys
- [ ] Test end-to-end conversation flow

### Phase 2: Retrieval & Recall
**Goal:** You can query "what do I know about X" and get answers

- [ ] OpenAI embeddings integration
- [ ] Generate embeddings for knowledge entries on save
- [ ] `/recall [topic]` command with vector search
- [ ] Relevance ranking and result formatting
- [ ] Decay weight in retrieval scoring

### Phase 3: Passive Data Ingestion
**Goal:** Your "what you've seen" layer is populated

- [ ] Google Takeout parser (browser history, search history)
- [ ] Twitter/X bookmark export parser
- [ ] GitHub API integration (repos, commits, starred repos)
- [ ] Batch ingestion pipeline with embeddings
- [ ] Activity signals table population
- [ ] Unified search across knowledge + activity

### Phase 4: Unified Retrieval & Synthesis
**Goal:** "Give me a blog topic" works end-to-end

- [ ] Blended retrieval (learned + seen layers)
- [ ] Synthesis prompts for LinkedIn post suggestions
- [ ] Synthesis prompts for blog topic suggestions
- [ ] Full outline generation for tech talks
- [ ] Platform-aware framing in outputs

### Phase 5: Polish & Intelligence
**Goal:** System gets smarter over time

- [ ] Quality ratings after conversations
- [ ] Curation session UI/flow
- [ ] Decay weight automatic adjustment
- [ ] Contradiction detection across knowledge entries
- [ ] Contextual push (explicit context mode)
- [ ] Style mirroring (learn user's voice from conversations)
- [ ] Scheduled check-in notifications
- [ ] Activity spike detection and prompts
