# Personal Knowledge Assistant

> Capture what you've **learned**, not just what you've seen.

A Telegram bot that extracts structured knowledge from conversations, storing learnings with semantic search for future retrieval and synthesis.

## What It Does

Have natural conversations about what you've learned. The bot extracts structured knowledge:
- **Problem** you solved
- **Solution** you discovered  
- **Key learnings** to remember
- **Tags** for organization
- **Semantic embeddings** for smart search

All stored in a searchable database for future recall.

## Quick Start

```bash
# Install
npm install

# Configure (see docs/development/SETUP.md)
cp .env.example .env
# Edit .env with your API keys

# Setup database
# Run scripts/init-database.sql in Supabase

# Run
npm run dev
```

**Required:** Node.js 18+, Telegram account, OpenRouter API key, OpenAI API key, Supabase account

See [docs/development/SETUP.md](docs/development/SETUP.md) for detailed setup.

## Usage Example

```
You: "I just debugged a tricky Kubernetes issue"
Bot: "Tell me about it! What happened?"

You: "Pod kept restarting due to liveness probe timeouts"
Bot: "What did you learn that you'd want to remember?"

You: "Always adjust probe timing for app startup"
Bot: "Got it. Use /extract when ready to save!"

You: /extract
Bot: "✅ Knowledge extracted and saved!"
```

See [USAGE.md](USAGE.md) for complete command reference.

## Tech Stack

- **Telegram Bot** - Always-available interface
- **OpenRouter + Vercel AI SDK** - Model-agnostic LLM (Claude, GPT-4, etc.)
- **OpenAI Embeddings** - Semantic search
- **Supabase** - Postgres + pgvector for storage
- **Railway.app** - 24/7 hosting

**Cost:** ~$3-7/month

## Current Status

**✅ Phase 1 Complete** - Core extraction working, deployed and live

- Natural conversation with knowledge extraction
- Multi-user support with isolated conversations  
- Persistence across server restarts
- Smart auto-save (every 10 messages or 5 minutes)
- Self-aware assistant with project context

**🚧 Phase 2 Next** - Add `/recall` for semantic search (infrastructure ready)

**🔮 Future** - Passive ingestion (browser history, GitHub), content synthesis (LinkedIn posts, blog ideas, tech talks)

See [MVP.md](MVP.md) for full vision and [TODO.md](TODO.md) for detailed roadmap.

## Documentation

### For Users
- **[USAGE.md](USAGE.md)** - How to use the bot
- **[MVP.md](MVP.md)** - Vision and future phases

### For Developers  
- **[docs/development/SETUP.md](docs/development/SETUP.md)** - Development setup
- **[docs/development/AGENTS.md](docs/development/AGENTS.md)** - AI coding guidelines
- **[docs/development/LOCAL_TESTING.md](docs/development/LOCAL_TESTING.md)** - Local testing

### For Deployment
- **[docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md)** - Deployment guide
- **[docs/deployment/POST_DEPLOYMENT_CHECKLIST.md](docs/deployment/POST_DEPLOYMENT_CHECKLIST.md)** - Verification

### Architecture
- **[docs/architecture/CONVERSATION_MANAGEMENT.md](docs/architecture/CONVERSATION_MANAGEMENT.md)** - Conversation lifecycle
- **[docs/architecture/CONVERSATION_PERSISTENCE.md](docs/architecture/CONVERSATION_PERSISTENCE.md)** - Restart behavior  
- **[docs/architecture/SYSTEM_PROMPTS.md](docs/architecture/SYSTEM_PROMPTS.md)** - Self-awareness

## Architecture

```
src/
├── config/              # Environment configuration
├── handlers/            # Telegram bot handlers
├── models/              # TypeScript interfaces
├── repositories/        # Database access layer
├── services/            # External API integrations
│   ├── llm.service.ts              # Vercel AI SDK + OpenRouter
│   ├── openai.service.ts           # Embeddings with retry
│   ├── supabase.service.ts         # Database
│   └── conversation-state.service.ts # State management
└── index.ts             # Entry point
```

## Development

```bash
npm test              # Run tests
npm run type-check    # TypeScript checks
npm run dev           # Development mode
npm run build         # Build for production
```

## Deployment

Currently live on **Railway.app** with auto-deploy on push.

Supports: Railway, Render, DigitalOcean, VPS, Docker

See [docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md) for platform-specific guides.

## License

ISC

---

**Status:** Phase 1 complete ✅ | Phase 2 starting 🚧  
**Deployment:** Live on Railway.app  
**Start using:** Message your Telegram bot!
