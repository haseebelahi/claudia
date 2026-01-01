# Personal Knowledge Assistant

A Telegram-based personal knowledge assistant that extracts and recalls learned knowledge through conversational interaction.

## Tech Stack

- **Node.js/TypeScript** - Runtime and language
- **Telegram Bot API** - Chat interface  
- **Vercel AI SDK + OpenRouter** - LLM integration (model-agnostic)
- **OpenAI** - Embeddings generation
- **Supabase** - Database (Postgres + pgvector)

## Setup

### Prerequisites

- Node.js >= 18.0.0
- Telegram account
- OpenRouter API key (or direct Claude/OpenAI access)
- OpenAI API key (for embeddings)
- Supabase account

### Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

Required variables:
- `TELEGRAM_BOT_TOKEN` - From @BotFather on Telegram
- `OPENROUTER_API_KEY` - From openrouter.ai
- `LLM_MODEL` - Model to use (e.g., `anthropic/claude-3.5-sonnet`)
- `OPENAI_API_KEY` - From platform.openai.com
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon key

3. **Set up database:**
```bash
# Run scripts/init-database.sql in your Supabase SQL editor
```

4. **Run the bot:**
```bash
# Development (with auto-reload)
npm run dev

# Production build
npm run build
npm start
```

## Usage

### Bot Commands

- `/status` - Show current conversation status
- `/new` - Start new conversation (prompts to extract/clear existing)
- `/extract` - Save current conversation as structured knowledge
- `/clear` - Discard current conversation and start fresh

### Conversation Flow

1. Start chatting with the bot naturally
2. Share what you've learned or problems you've solved
3. Bot asks follow-up questions to clarify
4. Use `/extract` to save the knowledge
5. Bot extracts structured knowledge with embeddings

Example:
```
You: "just spent 3 hours debugging a kubernetes issue"
Bot: "Nice! What was the issue? Walk me through what happened."
You: "pod kept getting OOMKilled even though memory limit was way higher than usage"
Bot: "Ah, the classic memory mysteries. What did you discover?"
You: "JVM wasn't respecting container limits. Had to upgrade to JVM 17"
Bot: "Got it - so JVM 17+ has better container awareness. What's the takeaway 
     you'd want to remember for next time?"
You: "Always check JVM version first when debugging memory issues in containers"
Bot: "Solid learning. Sounds like we've captured the key points - feel free 
     to /extract when you're ready to save this!"
You: "/extract"
Bot: "Extracting knowledge from our conversation..."
Bot: "✅ Knowledge extracted and saved!"
```

**Self-Aware Assistant**: The bot knows it's a knowledge extraction tool, understands 
your background as an 8+ year software engineer, and guides conversations toward 
extractable learnings. See `SYSTEM_PROMPTS.md` for details.

## Architecture

```
src/
├── config/              # Configuration management
├── handlers/            # Telegram bot handlers
├── models/              # TypeScript interfaces
├── services/            # External API integrations
│   ├── llm.service.ts          # LLM (via Vercel AI SDK)
│   ├── openai.service.ts       # Embeddings
│   ├── supabase.service.ts     # Database
│   └── conversation-state.service.ts  # In-memory state
└── index.ts             # Entry point
```

## Development

```bash
# Type checking
npm run type-check

# Build
npm run build

# Development with watch mode
npm run dev
```

## Deployment (Vercel)

This project can be deployed to Vercel as a long-running process:

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Set environment variables in Vercel dashboard
4. The bot will run as a serverless function

Note: For production, consider using Vercel's Background Functions or deploying to Railway/Render for long-running processes.

## Future Enhancements (Phase 2+)

- [ ] `/recall [topic]` - Search knowledge by topic
- [ ] Automatic conversation end detection
- [ ] Quality ratings for conversations
- [ ] Time decay for knowledge relevance
- [ ] Passive data ingestion (browser history, GitHub)
- [ ] Synthesis features (blog topics, LinkedIn posts)

## License

ISC
