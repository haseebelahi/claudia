# Deployment Guide

## Option 1: Railway.app (Recommended - Easiest)

Railway is perfect for this bot because it supports long-running processes (Telegram polling).

### Steps:

1. **Push code to GitHub** (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/personal-assistant.git
   git push -u origin main
   ```

2. **Sign up for Railway**:
   - Go to https://railway.app
   - Sign up with GitHub
   - Free tier: $5 credit/month (plenty for this bot)

3. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway auto-detects it's a Node.js app

4. **Add Environment Variables**:
   - In Railway dashboard, go to "Variables" tab
   - Add all variables from your `.env`:
     ```
     TELEGRAM_BOT_TOKEN=your_token
     OPENROUTER_API_KEY=your_key
     LLM_MODEL=anthropic/claude-3.5-sonnet
     LLM_BASE_URL=https://openrouter.ai/api/v1
     OPENAI_API_KEY=your_key
     SUPABASE_URL=your_url
     SUPABASE_KEY=your_key
     NODE_ENV=production
     CONVERSATION_TIMEOUT_MS=300000
     MAX_CONVERSATION_LENGTH=50
     ```

5. **Deploy**:
   - Railway automatically builds and deploys
   - Check logs to ensure bot started successfully
   - Look for "Bot started successfully" in logs

6. **Done!**
   - Bot runs 24/7
   - Auto-redeploys on git push
   - Restarts automatically if it crashes

### Railway Configuration

Files created for Railway:
- `railway.json` - Railway configuration
- `Procfile` - Start command
- `.dockerignore` - Files to exclude from build

---

## Option 2: Render.com (Also Easy, Free Tier)

Similar to Railway but with 750 hours/month free tier.

### Steps:

1. **Push to GitHub** (same as Railway)

2. **Sign up for Render**:
   - Go to https://render.com
   - Sign up with GitHub

3. **Create Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Settings:
     - **Name**: personal-assistant
     - **Environment**: Node
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Plan**: Free

4. **Add Environment Variables**:
   - In "Environment" tab, add all variables from `.env`

5. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment
   - Check logs for "Bot started successfully"

**Note**: Free tier sleeps after 15 min of inactivity. Upgrade to $7/month for always-on.

---

## Option 3: DigitalOcean App Platform

Simple deployment with $5/month tier.

### Steps:

1. **Push to GitHub** (same as above)

2. **Create App**:
   - Go to https://cloud.digitalocean.com/apps
   - Click "Create App"
   - Connect GitHub repo

3. **Configure**:
   - Detected as Node.js automatically
   - Build Command: `npm install && npm run build`
   - Run Command: `npm start`
   - Plan: Basic ($5/month)

4. **Add Environment Variables**:
   - Add all variables from `.env`

5. **Deploy**:
   - Click "Create Resources"
   - Bot will be running 24/7

---

## Option 4: VPS (DigitalOcean Droplet, AWS EC2, etc.)

Most control, requires more setup.

### Steps:

1. **Create VPS** ($4-5/month):
   - DigitalOcean Droplet (Ubuntu 22.04)
   - AWS EC2 t2.micro
   - Linode, etc.

2. **SSH into server**:
   ```bash
   ssh root@your-server-ip
   ```

3. **Install Node.js**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Install PM2** (process manager):
   ```bash
   npm install -g pm2
   ```

5. **Clone your repo**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/personal-assistant.git
   cd personal-assistant
   ```

6. **Install dependencies**:
   ```bash
   npm install
   npm run build
   ```

7. **Create .env file**:
   ```bash
   nano .env
   # Paste your environment variables
   ```

8. **Start with PM2**:
   ```bash
   pm2 start dist/index.js --name personal-assistant
   pm2 save
   pm2 startup
   ```

9. **Monitor**:
   ```bash
   pm2 logs personal-assistant
   pm2 status
   ```

---

## Option 5: Docker + Any Platform

Create a Docker container for maximum portability.

### Dockerfile:

I can create a Dockerfile if you want to go this route. Works with:
- Railway
- Render
- DigitalOcean
- AWS ECS
- Google Cloud Run
- Fly.io

---

## Recommendation

**For you: Railway.app**

Reasons:
1. ✅ Easiest setup (5 minutes)
2. ✅ Free tier ($5 credit/month - enough for this bot)
3. ✅ Auto-deploy on git push
4. ✅ Built-in logs and monitoring
5. ✅ No sleep (unlike Render free tier)
6. ✅ Supports long-running processes
7. ✅ Environment variables UI

## After Deployment

### Test the bot:
1. Message your bot on Telegram
2. Check Railway logs for "Bot started successfully"
3. Have a conversation
4. Use `/extract` to save knowledge
5. Check Supabase to verify data is being saved

### Monitoring:
- Railway dashboard shows logs, CPU, memory
- Set up alerts for crashes (Railway can notify via email)
- Check Supabase dashboard for database usage

### Updates:
```bash
# Make changes locally
git add .
git commit -m "Update feature"
git push

# Railway auto-deploys!
```

---

## Cost Estimate

**Monthly costs:**
- Railway: $0-5 (free tier covers it)
- Supabase: $0 (free tier)
- OpenRouter: ~$2-5 (depends on usage)
- OpenAI Embeddings: ~$1-2 (depends on usage)

**Total: ~$3-12/month**

---

## Quick Start (Railway)

Want me to walk you through Railway deployment? It takes about 5 minutes:

1. Do you have a GitHub repo for this?
2. If not, want me to help you create one and push the code?
