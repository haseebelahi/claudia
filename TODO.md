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

## Phase 2: Retrieval & Recall 🚧

**Goal:** Search and retrieve past knowledge

**Status:** Infrastructure ready, implementation pending

### Infrastructure (Ready)
- [x] Embeddings generated for all knowledge entries
- [x] Vector search function in Supabase (`match_knowledge()`)
- [x] Similarity scoring implemented

### To Implement
- [ ] `/recall [topic]` command for semantic search
  - [ ] Generate embedding for search query
  - [ ] Query Supabase vector search function
  - [ ] Format and rank results by relevance
  - [ ] Display with similarity scores
  
- [ ] Auto-context injection (optional)
  - [ ] Search for related knowledge when conversation starts
  - [ ] Inject relevant past learnings into conversation context
  - [ ] Bot references past knowledge naturally
  
- [ ] Duplicate detection (optional)
  - [ ] Before extraction, search for similar entries
  - [ ] Prompt user: "Similar to entry from 3 days ago - update or create new?"
  - [ ] Option to merge or keep separate

- [ ] Search improvements
  - [ ] Filter by date range
  - [ ] Filter by tags
  - [ ] Filter by knowledge type
  - [ ] Hybrid search (semantic + keyword)

**Estimated Effort:** 2-4 hours for basic `/recall` command

---

## Phase 3: Passive Data Ingestion 📋

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

## Current Sprint (Next 2 Weeks)

### Priority 1: Phase 2 - Basic Recall
- [ ] Implement `/recall [topic]` command
- [ ] Test with existing knowledge entries
- [ ] Document usage in USAGE.md

### Priority 2: Polish Phase 1
- [ ] Add unit tests for repositories
- [ ] Add integration tests for extraction
- [ ] Improve error handling in edge cases

### Priority 3: Documentation
- [x] Reorganize documentation structure
- [x] Create comprehensive README
- [x] Create TODO roadmap (this file)
- [ ] Update architecture diagrams

---

## Success Metrics

### Phase 1 ✅
- [x] One successful knowledge extraction conversation
- [x] Deployed and running 24/7
- [x] Multi-user support working
- [x] Persistence across restarts

### Phase 2 (Next)
- [ ] Successfully recall knowledge from 10+ entries
- [ ] <2 second search response time
- [ ] >0.7 relevance score for top results

### Phase 3
- [ ] 1000+ activity signals ingested
- [ ] Unified search across knowledge + activity
- [ ] <3 second response time for hybrid search

### Phase 4
- [ ] Generate 10+ useful LinkedIn post ideas
- [ ] Generate 5+ blog outlines
- [ ] Generate 3+ tech talk topics

### Phase 5
- [ ] 100+ knowledge entries with ratings
- [ ] Contradiction detection working
- [ ] Style mirroring noticeable in responses

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| 0.1.0 | 2026-01-01 | Phase 1 complete - Core extraction working |
| 0.2.0 | TBD | Phase 2 - `/recall` command live |
| 0.3.0 | TBD | Phase 3 - Passive ingestion working |
| 1.0.0 | TBD | Phases 1-4 complete, production-ready |

---

**Last Updated:** January 2, 2026  
**Current Phase:** Phase 1 Complete ✅ → Phase 2 Starting 🚧  
**Next Milestone:** `/recall` command implementation
