# Project Roadmap & TODO

Current status and implementation roadmap for the Personal Knowledge Assistant.

## Current Status

**Phase 1: Core Extraction Loop** ✅ **COMPLETE & LIVE**  
**Deployment:** Railway.app (24/7 uptime)  
**Date Completed:** January 1, 2026

---

## Phase 1: Core Extraction Loop ✅

**Goal:** Extract and store knowledge through conversation

### Infrastructure
- [x] Telegram bot setup via BotFather
- [x] Supabase project with Postgres + pgvector
- [x] OpenRouter API integration (model-agnostic via Vercel AI SDK)
- [x] OpenAI embeddings integration
- [x] Railway.app deployment with auto-deploy
- [x] Environment configuration

### Core Features
- [x] Natural LLM-powered conversations
- [x] Conversation state tracking (in-memory + DB)
- [x] Smart auto-save (10 messages or 5 minutes)
- [x] Multi-user support with isolated conversations
- [x] Conversation persistence across server restarts
- [x] Self-aware system prompts (knows project context)
- [x] No conversation timeouts

### Bot Commands
- [x] `/status` - Show conversation status
- [x] `/show` - Display conversation transcript
- [x] `/history` - List previous conversations
- [x] `/new` - Start new conversation prompt
- [x] `/extract` - Save knowledge with embeddings
- [x] `/clear` - Discard current conversation
- [x] `/discard <id>` - Delete specific conversation

### Knowledge Extraction
- [x] Structured extraction: type, problem, context, solution, learnings, tags
- [x] 4 knowledge types: problem_solution, insight, decision, learning
- [x] OpenAI embeddings generation (text-embedding-3-small)
- [x] Vector storage in Supabase with pgvector
- [x] Foreign key relationships maintained

### Architecture
- [x] Repository pattern for database access
- [x] Service layer for external APIs
- [x] Retry logic for OpenAI API calls
- [x] Error handling and graceful degradation
- [x] Memory management with cleanup

### Documentation
- [x] Comprehensive README.md
- [x] Development guides (SETUP, AGENTS, LOCAL_TESTING)
- [x] Deployment guides (multi-platform)
- [x] Architecture documentation
- [x] Usage guide (COMMANDS.md)

---

## Phase 2.5: Foundation Migration 🚧

**Goal:** Migrate to Thought Model v1 + Claude Agent SDK for agentic capabilities

**Status:** In Progress - Deploy & Test

**Decision (Jan 5, 2026):** Claude Agent SDK chosen for velocity. ~$1/day token budget acceptable.

### Schema Migration
- [x] Design new extraction prompt (Thought Model v1 output format)
- [x] Create `sources` table SQL (in scripts/phase-2.5-thought-model.sql)
- [x] Create `thoughts` table SQL (in scripts/phase-2.5-thought-model.sql)
- [x] Create `thought_sources` junction table SQL (in scripts/phase-2.5-thought-model.sql)
- [x] Run SQL migration in Supabase ✅
- [ ] Implement Markdown vault writer (`vault/thoughts/`, `vault/sources/`)
- [x] Update `extractAndSave()` to write new schema (clean cutover)
- [x] Update `/remember` to create thoughts instead of knowledge_entries
- [x] Update `/recall` to query thoughts table
- [x] Migration script: existing conversations → sources (in SQL)
- [x] Migration script: existing knowledge_entries → thoughts (in SQL)

### Claude Agent SDK Integration
- [ ] Install `@anthropic-ai/claude-agent-sdk`
- [ ] Create MCP wrapper for Telegram handler
- [ ] Create MCP wrapper for knowledge service
- [ ] Update system prompts for agent mode
- [ ] Build `/read [url]` with SDK's WebFetch
- [ ] Build `/research [topic]` with SDK's WebSearch

### Markdown Vault
- [ ] Define vault directory structure
- [ ] Implement thought → markdown serializer
- [ ] Implement source → markdown serializer
- [ ] Git integration for version control (optional)

---

## Phase 2: Retrieval & Recall ✅

**Goal:** Search and retrieve past knowledge

**Status:** Phase 2A complete, Phase 2B/C moved to Phase 2.5

### Phase 2A: Retrieval & Quick Storage ✅
- [x] `/recall [topic]` command for semantic search
  - [x] Generate embedding for search query
  - [x] Query Supabase vector search function with user filter
  - [x] Format and rank results by relevance
  - [x] Display with similarity scores (top 5 results)
- [x] `/remember [fact]` command for quick fact storage
  - [x] Auto-categorization via LLM (fact, preference, event, relationship, goal)
  - [x] Category confirmation with inline keyboard buttons
  - [x] Correction option via category picker
  - [x] Embeddings generation and storage
- [x] Database updates
  - [x] Added `user_id` column to `knowledge_entries`
  - [x] Updated `match_knowledge` function with user filter
  - [x] Expanded entry types for /remember

### Phase 2B: Article Ingestion (Pending)
- [ ] `/read [url]` command
  - [ ] Web page fetching and content extraction
  - [ ] LLM summarization of article content
  - [ ] Optional extraction to knowledge base as `article_summary` type
  - [ ] Handle common article formats (blogs, docs, news)

### Phase 2C: Web Research (Pending)
- [ ] `/research [topic]` command
  - [ ] Google Custom Search API integration (free tier: 100/day)
  - [ ] Fetch and parse top 3 search results
  - [ ] LLM compilation of findings
  - [ ] Auto-save as `research` type knowledge entry
  - [ ] Source attribution in stored entry

### Future Improvements (Optional)
- [ ] Auto-context injection
  - [ ] Search for related knowledge when conversation starts
  - [ ] Inject relevant past learnings into conversation context
  - [ ] Bot references past knowledge naturally
  
- [ ] Duplicate detection
  - [ ] Before extraction, search for similar entries
  - [ ] Prompt user: "Similar to entry from 3 days ago - update or create new?"
  - [ ] Option to merge or keep separate

- [ ] Search improvements
  - [ ] Filter by date range
  - [ ] Filter by tags
  - [ ] Filter by knowledge type
  - [ ] Hybrid search (semantic + keyword)

---

## Phase 3: Profile Building 📋

**Goal:** Populate "what you've seen" layer

### Data Sources
- [ ] Google Takeout parser
  - [ ] Browser history ingestion
  - [ ] Search history parsing
  - [ ] Batch processing with embeddings
  
- [ ] Twitter/X integration
  - [ ] Bookmark export parser
  - [ ] Thread extraction
  - [ ] Embedding generation
  
- [ ] GitHub integration
  - [ ] GitHub API connection
  - [ ] Repository activity tracking
  - [ ] Commit message analysis
  - [ ] Starred repos ingestion
  
- [ ] Activity signals table
  - [ ] Populate from parsed data
  - [ ] Embeddings for all signals
  - [ ] Time decay implementation

### Infrastructure
- [ ] Batch ingestion pipeline
- [ ] Deduplication logic
- [ ] Incremental sync capability
- [ ] Manual trigger UI/commands

### Search Integration
- [ ] Unified search (knowledge + activity)
- [ ] Relevance weighting
- [ ] Source attribution in results

**Estimated Effort:** 1-2 weeks

---

## Phase 4: Content Synthesis 🎨

**Goal:** Generate content from knowledge base

### LinkedIn Posts
- [ ] Post topic suggestion based on knowledge
- [ ] Draft generation with your voice
- [ ] Platform-appropriate framing
- [ ] Length optimization (300-500 words)

### Blog Topics
- [ ] Topic discovery from knowledge clusters
- [ ] Outline generation
- [ ] Key points extraction
- [ ] Related knowledge linking

### Tech Talks
- [ ] Talk topic suggestions
- [ ] Full outline generation (intro, body, conclusion)
- [ ] Slide content suggestions
- [ ] Demo/example ideas from your knowledge

### Implementation
- [ ] New synthesis prompt templates
- [ ] `/suggest linkedin` command
- [ ] `/suggest blog` command
- [ ] `/suggest talk` command
- [ ] Platform-aware framing system
- [ ] Style mirroring from past content

**Estimated Effort:** 1 week

---

## Phase 5: Intelligence & Polish 🧠

**Goal:** System gets smarter over time

### Quality Control
- [ ] Post-conversation ratings (1-5 stars)
- [ ] Periodic curation sessions
- [ ] Rating-based relevance boosting
- [ ] Low-quality entry archiving

### Time Decay
- [ ] Automatic decay weight calculation
- [ ] Age-based relevance adjustment
- [ ] Configurable decay curves per topic
- [ ] Manual "evergreen" marking

### Contradiction Detection
- [ ] Cross-entry contradiction identification
- [ ] User notification of conflicts
- [ ] Clarification prompts
- [ ] Knowledge update workflow

### Proactive Features
- [ ] Scheduled check-in notifications
- [ ] Activity spike detection
- [ ] Suggested extraction prompts
- [ ] "Haven't talked in a while" reminders

### Style Learning
- [ ] Analyze user's conversation style
- [ ] Mirror tone and vocabulary
- [ ] Platform-specific voice adaptation
- [ ] Continuous learning from interactions

### Advanced Search
- [ ] Learning gap analysis
- [ ] Pattern matching across knowledge
- [ ] Decision support queries
- [ ] "What do I not know about X?"

**Estimated Effort:** 2-3 weeks

---

## Backlog / Future Ideas 💡

### Integrations
- [ ] Slack/Discord versions of the bot
- [ ] Web interface for browsing knowledge
- [ ] Mobile app (optional)
- [ ] API for external access
- [ ] Obsidian/Notion export

### Advanced Features
- [ ] Knowledge graph visualization
- [ ] Topic clustering and discovery
- [ ] Collaborative knowledge sharing (optional)
- [ ] Voice note transcription and extraction
- [ ] Image/screenshot analysis

### Infrastructure
- [ ] Redis caching for multi-instance deployments
- [ ] Separate read replicas for search
- [ ] Backup and restore functionality
- [ ] Knowledge export (JSON, Markdown)
- [ ] Migration tools between databases

### Analytics
- [ ] Knowledge growth tracking
- [ ] Topic distribution analysis
- [ ] Extraction quality metrics
- [ ] Usage patterns dashboard

---

## Technical Debt & Improvements

### High Priority
- [ ] Add comprehensive unit tests (>80% coverage)
- [ ] Add integration tests for conversation flow
- [ ] Implement rate limiting for API calls
- [ ] Add request queuing for LLM calls
- [ ] Improve error messages for users

### Medium Priority
- [ ] Add TypeScript strict mode checks
- [ ] Implement structured logging
- [ ] Add performance monitoring
- [ ] Database query optimization
- [ ] Memory usage profiling

### Low Priority
- [ ] Add ESLint and Prettier
- [ ] Set up pre-commit hooks
- [ ] CI/CD pipeline improvements
- [ ] Automated testing in deployment pipeline

---

## Current Sprint: Phase 2.5 Foundation Migration

### Priority 1: Prompt & Schema Design ✅
- [x] Design new EXTRACTION prompt (Thought Model v1 output)
- [x] Design new CONVERSATION prompt (surgical question flow)
- [x] Finalize thought kinds and mapping from legacy types
- [x] Document prompt design decisions (in SYSTEM_PROMPTS.md)

### Priority 2: Database Schema ✅
- [x] Create `sources`, `thoughts`, `thought_sources` SQL (scripts/phase-2.5-thought-model.sql)
- [x] Create vector search function for thoughts (match_thoughts)
- [x] Run SQL migration in Supabase ✅
- [x] Migrate existing data (11 conversations → sources, 4 knowledge_entries → thoughts)

### Priority 3: Code Implementation ✅
- [x] Update extraction to write thoughts + sources
- [x] Update /remember to write thoughts
- [x] Update /recall to query thoughts table
- [ ] Implement Markdown vault persistence (deferred)

### Priority 4: Deploy & Test ← CURRENT
- [ ] Deploy updated code to Railway
- [ ] Verify end-to-end flow works
- [ ] Test /remember, /recall, /extract with new schema

---

## Success Metrics

### Phase 1 ✅
- [x] One successful knowledge extraction conversation
- [x] Deployed and running 24/7
- [x] Multi-user support working
- [x] Persistence across restarts

### Phase 2A ✅
- [x] `/recall` command working with semantic search
- [x] `/remember` command with auto-categorization
- [x] User-scoped knowledge filtering

### Phase 2B/C (Next)
- [ ] Successfully summarize 10+ articles
- [ ] Research command returns useful compilations
- [ ] <3 second response time for /read

### Phase 3
- [ ] Profile knowledge built through conversations
- [ ] Foundation for LinkedIn synthesis ready

### Phase 4
- [ ] Generate 10+ useful LinkedIn post ideas
- [ ] Generate 5+ blog outlines
- [ ] Generate 3+ tech talk topics

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| 0.1.0 | 2026-01-01 | Phase 1 complete - Core extraction working |
| 0.2.0 | 2026-01-02 | Phase 2A complete - /recall and /remember commands |
| 0.3.0 | TBD | Phase 2.5 - Thought Model v1 + Claude Agent SDK |
| 0.4.0 | TBD | Phase 2B/C - /read and /research commands |
| 0.5.0 | TBD | Phase 3 - Profile building |
| 1.0.0 | TBD | Phases 1-4 complete, production-ready |

---

**Last Updated:** January 5, 2026
**Current Phase:** Phase 2.5 Foundation Migration 🚧
**Next Milestone:** Deploy and test Thought Model v1 end-to-end
