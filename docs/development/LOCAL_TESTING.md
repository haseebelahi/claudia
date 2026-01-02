# Local Testing Guide

## Problem

You cannot run two instances of the same Telegram bot simultaneously (production on Railway + local development). Telegram only allows one active webhook/polling connection per bot token.

## Solutions

### Option 1: Create a Separate Development Bot (Recommended)

This is the best approach for ongoing development work.

#### Steps:

1. **Create a new Telegram bot for development**:
   - Open Telegram and message [@BotFather](https://t.me/botfather)
   - Send `/newbot`
   - Choose a name: `MyBot Dev` (or whatever you prefer)
   - Choose a username: `my_bot_dev_bot` (must end with "bot")
   - BotFather will give you a new API token

2. **Create a local `.env` file**:
   ```bash
   cp .env.example .env
   ```

3. **Update your local `.env` with the dev bot token**:
   ```env
   # Use your DEV bot token locally
   TELEGRAM_BOT_TOKEN=your_dev_bot_token_here
   
   # Other variables remain the same
   OPENROUTER_API_KEY=your_openrouter_api_key
   OPENAI_API_KEY=your_openai_api_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   
   # Conversation Configuration
   MAX_CONVERSATION_LENGTH=200
   
   # Environment
   NODE_ENV=development
   PORT=3000
   ```

4. **Keep production bot token in Railway**:
   - Railway uses environment variables you set in the dashboard
   - Production bot token stays there
   - Never commit your `.env` file (it's in `.gitignore`)

5. **Test locally**:
   ```bash
   npm run dev
   ```
   
6. **Chat with your dev bot** on Telegram (search for `@my_bot_dev_bot`)

#### Advantages:
- ✅ Production and development completely isolated
- ✅ Can test freely without affecting production users
- ✅ No need to stop/start Railway deployments
- ✅ Both bots can use the same Supabase database (different user IDs)

#### Disadvantages:
- Need to maintain two bots
- Need to switch between bots when testing

---

### Option 2: Stop Railway Before Local Testing (Quick Testing)

If you just need to test something quickly and don't want to create a dev bot:

#### Steps:

1. **Stop the Railway deployment**:
   - Go to Railway dashboard
   - Find your deployment
   - Click "Stop" or temporarily remove the bot service

2. **Run locally**:
   ```bash
   npm run dev
   ```

3. **Test with the production bot** on Telegram

4. **Restart Railway when done**:
   - Click "Start" in Railway dashboard
   - Or redeploy by pushing to your git branch

#### Advantages:
- ✅ No need to create a second bot
- ✅ Test with real production bot

#### Disadvantages:
- ❌ Production bot goes offline during testing
- ❌ Manual process to stop/start
- ❌ Can affect users if they try to use the bot

---

### Option 3: Use Environment-Based Bot Tokens

Set up your code to use different bot tokens based on environment:

#### Already supported in your codebase!

Your `src/config/index.ts` reads from environment variables:

```typescript
telegram: {
  botToken: getEnvVar('TELEGRAM_BOT_TOKEN'),
}
```

#### To use this:

1. **Set different tokens in different environments**:
   - **Local** `.env`: Dev bot token
   - **Railway**: Production bot token (set in Railway dashboard)

2. **Run locally**:
   ```bash
   npm run dev
   ```

3. **Deploy to Railway** (uses production token automatically)

This is actually **Option 1** - you just need to create the dev bot!

---

## Recommended Workflow

**For active development** (best approach):

```bash
# 1. Create dev bot (one-time setup)
# Message @BotFather on Telegram

# 2. Set up local .env with dev bot token
cp .env.example .env
# Edit .env and add your dev bot token

# 3. Run local development
npm run dev

# 4. Test with dev bot on Telegram
# Search for @your_dev_bot

# 5. When ready, commit and push
git add .
git commit -m "feat: implemented feature X"
git push

# 6. Railway auto-deploys with production bot token
# Production users use the production bot
```

**For quick fixes** (if you don't want to create dev bot):

```bash
# 1. Stop Railway deployment temporarily
# (via Railway dashboard)

# 2. Run locally with production bot
npm run dev

# 3. Test on Telegram

# 4. Stop local, restart Railway
```

---

## Testing Specific Features

### Testing Smart Save Logic (10 messages / 5 minutes)

With dev bot running locally:

1. Send 9 messages back and forth
2. Check Supabase - should NOT have saved yet
3. Send 10th message
4. Check Supabase - should see the conversation saved
5. Check logs: `Conversation saved for user XXX (threshold reached)`

### Testing Retry Logic

With dev bot running locally:

1. Temporarily set invalid OpenAI API key in `.env`
2. Have a conversation and try `/extract`
3. Check logs - should see retry attempts:
   ```
   OpenAI embedding attempt 1/3 failed: Unauthorized. Retrying in 1000ms...
   OpenAI embedding attempt 2/3 failed: Unauthorized. Retrying in 2000ms...
   OpenAI embedding attempt 3/3 failed: Unauthorized. Retrying in 4000ms...
   ```
4. Fix API key and retry `/extract` - should succeed

### Testing Long Conversations (200 messages)

You can script this to make it faster:

```bash
# Send lots of test messages programmatically
# (Would need to create a test script)
```

Or manually test with 20-30 messages to verify the feature works.

### Testing Memory Cleanup

This requires waiting 1 hour after `/extract`, which is impractical. The unit tests cover this functionality.

---

## Environment Variables Checklist

### Local `.env` (Development)
```env
TELEGRAM_BOT_TOKEN=<dev_bot_token>    # Different from production
OPENROUTER_API_KEY=<same>
OPENAI_API_KEY=<same>
SUPABASE_URL=<same>
SUPABASE_KEY=<same>
MAX_CONVERSATION_LENGTH=200
NODE_ENV=development
PORT=3000
```

### Railway (Production)
Set these in Railway dashboard under "Variables":
```
TELEGRAM_BOT_TOKEN=<production_bot_token>    # Different from dev
OPENROUTER_API_KEY=<same>
OPENAI_API_KEY=<same>
SUPABASE_URL=<same>
SUPABASE_KEY=<same>
MAX_CONVERSATION_LENGTH=200
NODE_ENV=production
```

---

## Quick Reference

| Scenario | Action |
|----------|--------|
| Daily development | Use dev bot (Option 1) |
| Quick bug fix | Stop Railway, use prod bot (Option 2) |
| Testing in production | Deploy to Railway, use prod bot |
| Running unit tests | `npm test` (no bot needed) |

---

## Troubleshooting

### "Conflict: terminated by other getUpdates request"

This means two instances are trying to poll the same bot:
- Check if Railway is still running
- Check if you have another local instance running
- Make sure you're using different bot tokens for dev and prod

### Bot not responding locally

1. Check the bot is running: `npm run dev`
2. Check logs for errors
3. Verify `.env` has correct `TELEGRAM_BOT_TOKEN`
4. Make sure you're messaging the correct bot on Telegram

### Changes not appearing in production

1. Check Railway deployment logs
2. Verify environment variables are set correctly in Railway
3. Railway auto-deploys on git push to main branch
4. Check `railway logs` for any errors

---

**Recommendation**: Set up Option 1 (dev bot) for the smoothest development experience!
