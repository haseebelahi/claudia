# Conversation Persistence Across Server Restarts

## How It Works Now

The bot now **remembers conversations across server restarts** using lazy-loading:

### On Server Start:
- Bot initializes but doesn't load any conversations yet
- Waits for users to message

### On First Message from User:
1. Check if we've loaded this user's conversation before (in this session)
2. If not, query database for their active conversation
3. If found, load it into memory (messages + conversation ID)
4. Mark user as "loaded" so we don't query DB again
5. Continue conversation from where it left off

### On Subsequent Messages:
- Use in-memory state (no DB queries)
- Save to DB after each message exchange

## Example Flow

### Scenario: Server Restart Mid-Conversation

```
Session 1:
You: "I'm debugging a weird Kubernetes issue"
Bot: "Tell me more! What's happening?"
You: "Pods keep restarting"
[Server restarts]

Session 2 (after restart):
You: "It was a liveness probe timeout"
Bot: [Loads conversation from DB]
Bot: "Ah! So the probe timeout was causing the restarts. 
     What did you change to fix it?"
[Conversation continues seamlessly]
```

### What Gets Loaded:
- ✅ Conversation ID (so extraction saves to same conversation)
- ✅ All previous messages
- ✅ Conversation status (active/extracted/archived)
- ✅ Inactivity timeout (restarts if conversation is still active)

## Database Queries

**Minimal queries for performance:**
- 1 query per user on their first message (after restart)
- 0 queries for subsequent messages (in-memory)
- 1 update query after each message exchange (to save transcript)

## Implementation Details

### Lazy Loading Strategy
We use **lazy loading** instead of loading all conversations on startup because:
- Don't know which users will message the bot
- More efficient (only load what's needed)
- Scales to multiple users

### Tracking Loaded Users
```typescript
private loadedUsers: Set<string> = new Set();
```
- Prevents redundant DB queries
- Resets on server restart (intentionally)
- Each restart re-checks DB for latest conversation state

### Conversation State Service
- `hasLoadedUser(userId)` - Check if we've queried DB for this user
- `markUserAsLoaded(userId)` - Mark user as checked
- `loadConversationFromDB(conversation)` - Load conversation into memory

## Edge Cases Handled

### 1. User has no active conversation
- DB query returns null
- Create new conversation
- Mark user as loaded

### 2. User clears conversation
- Mark as archived in DB
- Clear from memory
- On restart, won't load archived conversation

### 3. User extracts knowledge
- Mark conversation as 'extracted' in DB  
- End conversation in memory
- On restart, won't load extracted conversation
- Fresh conversation starts

### 4. Multiple restarts
- Each restart checks DB for latest state
- Always loads most recent active conversation
- Properly handles status changes

## Testing

### Test 1: Mid-conversation restart
```bash
# Start conversation
You: "Hey, I learned something today"
Bot: "Tell me about it!"

# Restart server
npm run build && npm start

# Continue
You: "It was about React hooks"
Bot: [Should remember previous message and continue]
```

### Test 2: Restart after extraction
```bash
# Have conversation and extract
You: "I fixed a bug"
Bot: [conversation...]
You: /extract
Bot: "✅ Knowledge extracted and saved!"

# Restart server
npm run build && npm start

# New message should start fresh conversation
You: "Another thing I learned"
Bot: [Should start new conversation, not load previous]
```

### Test 3: Multiple users
```bash
# User A messages
User A: "Hello"
[Loads User A's active conversation if exists]

# User B messages  
User B: "Hi"
[Loads User B's active conversation if exists]
[Conversations are completely isolated]
```

## Configuration

Conversation timeout (defaults to 5 minutes):
```env
CONVERSATION_TIMEOUT_MS=300000
```

After timeout, conversation ends but remains in DB with status='active' until extracted/cleared.

## Future Enhancements

Potential improvements:
- Pre-load conversations for known frequent users on startup
- Cache conversations in Redis for multi-instance deployments
- Add conversation resumption notifications ("Continuing from earlier...")
- Show message count when resuming ("Continuing conversation, 8 messages so far")
