# Setup Guide

## What I Need From You

### 1. Install Node.js

You don't have Node.js installed. Please install it:

**Option A: Using Homebrew (recommended for Mac)**
```bash
brew install node
```

**Option B: Download from nodejs.org**
Visit https://nodejs.org and download the LTS version.

After installation, verify:
```bash
node --version  # Should show v18 or higher
npm --version   # Should show npm version
```

### 2. Install Dependencies

Once Node.js is installed:
```bash
npm install
```

### 3. Create .env File

Copy the example and fill in your credentials:
```bash
cp .env.example .env
```

Then edit `.env` with your actual values:

```env
# Get from @BotFather on Telegram
TELEGRAM_BOT_TOKEN=your_actual_bot_token

# Get from openrouter.ai (free tier available)
OPENROUTER_API_KEY=your_openrouter_api_key
LLM_MODEL=anthropic/claude-3.5-sonnet
LLM_BASE_URL=https://openrouter.ai/api/v1

# Get from platform.openai.com
OPENAI_API_KEY=your_openai_api_key

# From your Supabase project dashboard
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# Optional - defaults are fine
NODE_ENV=development
PORT=3000
CONVERSATION_TIMEOUT_MS=300000
MAX_CONVERSATION_LENGTH=50
```

### 4. Database Setup

✅ Initial schema done! You ran `scripts/init-database.sql` successfully.

⚠️ **New: Run the user_id migration:**
```bash
# Run scripts/add-user-id.sql in your Supabase SQL editor
```

This adds user_id column to support multiple users and track conversations per user.

### 5. Run the Bot

```bash
# Development mode (auto-reloads on changes)
npm run dev

# Or build and run production
npm run build
npm start
```

## Testing the Bot

1. Open Telegram
2. Search for your bot (username you created with @BotFather)
3. Start a chat
4. Try these commands:
   - `/status` - Check bot status
   - Send any message to start a conversation
   - `/extract` - Save the conversation as knowledge
   - `/clear` - Clear current conversation

## What's Been Built

✅ **Complete Phase 1 Implementation:**
- TypeScript project structure
- All models and types
- LLM service (using Vercel AI SDK + OpenRouter)
- OpenAI service (for embeddings)
- Supabase service (database operations)
- Conversation state management (in-memory)
- Telegram bot handler with all commands
- Extraction and storage pipeline

✅ **Key Features:**
- Natural conversation with LLM
- Automatic conversation tracking
- Manual extraction with `/extract`
- Structured knowledge storage with embeddings
- Status monitoring with `/status`
- Conversation clearing with `/clear`

## Architecture Benefits

**Model Flexibility:** Using Vercel AI SDK means you can easily switch between:
- OpenRouter (access to Claude, GPT-4, Mistral, etc.)
- Direct OpenAI
- Direct Anthropic
- Local models (Ollama)

Just change the config and provider - no code changes needed!

## Next Steps

After you get it running:

1. **Test the conversation flow** - Have a real conversation and use `/extract`
2. **Check Supabase** - Verify data is being saved to `conversations` and `knowledge_entries` tables
3. **Phase 2**: Add `/recall` command for semantic search
4. **Phase 3**: Add passive data ingestion (browser history, GitHub)

## Troubleshooting

**Bot not responding?**
- Check `.env` file has correct `TELEGRAM_BOT_TOKEN`
- Ensure bot is running (`npm run dev` should show "Bot started successfully")

**Database errors?**
- Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct
- Check Supabase dashboard that tables were created

**LLM errors?**
- Verify `OPENROUTER_API_KEY` is valid
- Check openrouter.ai dashboard for credits/quota

**Embedding errors?**
- Verify `OPENAI_API_KEY` is valid
- Check OpenAI dashboard for credits/quota
