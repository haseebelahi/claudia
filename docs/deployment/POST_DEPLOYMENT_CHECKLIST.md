# Post-Deployment Checklist

## ✅ Verify Deployment

### 1. Check Railway Logs
- Go to Railway dashboard → Your project → Deployments
- Look for: `Bot started successfully`
- No errors about missing environment variables
- No database connection errors

### 2. Test the Bot on Telegram
```
You: /status
Bot: Should respond with conversation status

You: Hello!
Bot: Should respond conversationally

You: [Have a short conversation about a learning]
Bot: [Should ask follow-up questions]

You: /extract
Bot: Should extract and save knowledge

You: /status
Bot: Should show new conversation (previous was extracted)
```

### 3. Verify Database Connection
- Go to Supabase dashboard
- Check `conversations` table - should have entries
- Check `knowledge_entries` table - should have extracted knowledge
- Verify embeddings are present in knowledge_entries

### 4. Test Conversation Persistence
```
You: Start a conversation with the bot
You: Send 2-3 messages
[Go to Railway dashboard]
[Manually restart the deployment]
You: Send another message
Bot: Should continue from where you left off
```

---

## 🐛 Common Issues

### Issue: Bot not responding
**Check:**
- Railway logs for errors
- `TELEGRAM_BOT_TOKEN` is correct in Railway environment variables
- Bot is not running locally (stop local instance)

**Fix:**
- Verify environment variables in Railway
- Check Railway logs for specific error
- Restart deployment in Railway

### Issue: "Missing environment variable" error
**Check:**
- All variables from `.env.example` are added in Railway
- No typos in variable names

**Fix:**
- Add missing variables in Railway dashboard → Variables tab
- Railway auto-redeploys when you add variables

### Issue: Database errors
**Check:**
- `SUPABASE_URL` and `SUPABASE_KEY` are correct
- Supabase project is not paused (free tier pauses after inactivity)
- Database migrations ran successfully

**Fix:**
- Verify Supabase credentials
- Wake up Supabase project if paused
- Re-run database migrations if needed

### Issue: LLM not responding
**Check:**
- `OPENROUTER_API_KEY` is valid
- OpenRouter account has credits
- `LLM_MODEL` is a valid model name

**Fix:**
- Check OpenRouter dashboard for API key status
- Add credits to OpenRouter account if needed
- Verify model name (e.g., `anthropic/claude-3.5-sonnet`)

### Issue: Extraction fails
**Check:**
- `OPENAI_API_KEY` is valid (for embeddings)
- OpenAI account has credits
- Railway logs for specific error

**Fix:**
- Verify OpenAI API key
- Add credits to OpenAI account
- Check logs for detailed error message

---

## 📊 Monitoring

### Railway Dashboard
- **Metrics**: CPU, Memory, Network usage
- **Logs**: Real-time logs (click "View Logs")
- **Deployments**: History of all deployments

### What to Monitor
- Memory usage (should stay under 512MB)
- CPU usage (should be minimal when idle)
- Deployment status (should show "Success")
- Logs for any errors or warnings

### Set Up Alerts
1. Go to Railway project settings
2. Enable deployment notifications
3. Add your email for crash alerts

---

## 🔄 Making Updates

### Deploy Updates
```bash
# Make changes locally
git add .
git commit -m "Description of changes"
git push

# Railway automatically:
# 1. Detects the push
# 2. Builds the new version
# 3. Deploys it
# 4. Restarts the bot
```

### Rollback if Needed
1. Go to Railway → Deployments
2. Click on a previous successful deployment
3. Click "Redeploy"

---

## 🎯 Next Steps

### Immediate:
- [ ] Test all commands: `/status`, `/new`, `/extract`, `/clear`
- [ ] Verify conversation persistence (restart test)
- [ ] Check Supabase tables have data
- [ ] Have a real conversation and extract knowledge

### Soon:
- [ ] Implement Phase 2: `/recall` command (semantic search)
- [ ] Add more knowledge entries
- [ ] Test multi-day conversation continuity

### Future:
- [ ] Phase 3: Passive data ingestion (browser history, GitHub)
- [ ] Phase 4: Content synthesis (LinkedIn posts, blog ideas)
- [ ] Quality ratings for conversations

---

## 💡 Tips

### Cost Optimization
- Railway free tier: $5/month credit (should be enough)
- Monitor usage in Railway dashboard
- If you exceed free tier, upgrade to $5/month plan

### Database Backups
- Supabase automatically backs up daily
- Can manually export from Supabase dashboard
- Consider weekly manual backups of knowledge_entries table

### API Key Security
- Never commit `.env` to git (already in `.gitignore`)
- Rotate API keys periodically
- Use Railway's secret variables (already doing this)

### Performance
- Bot responds instantly (in-memory conversations)
- First message after restart: ~100-200ms (DB load)
- Extraction: ~2-5 seconds (LLM + embedding generation)

---

## 📝 Useful Commands

### View Railway Logs Locally
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# View logs
railway logs
```

### Check Bot Status
Send `/status` to your bot on Telegram

### Manual Database Check
```sql
-- In Supabase SQL editor

-- Count conversations
SELECT COUNT(*) FROM conversations;

-- View recent conversations
SELECT id, user_id, status, created_at 
FROM conversations 
ORDER BY created_at DESC 
LIMIT 5;

-- Count knowledge entries
SELECT COUNT(*) FROM knowledge_entries;

-- View recent knowledge
SELECT type, problem, tags, created_at 
FROM knowledge_entries 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## 🚀 You're Live!

Your personal knowledge assistant is now running 24/7 on Railway!

- **Bot URL**: Check Railway dashboard for deployment URL (not needed for Telegram)
- **Logs**: Railway dashboard → View Logs
- **Metrics**: Railway dashboard → Metrics tab

Start capturing your learnings! 🧠
