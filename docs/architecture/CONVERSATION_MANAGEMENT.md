# Conversation Management

## Changes Made

### 1. Database Schema Update
Run this SQL in your Supabase SQL editor:
```sql
-- Add user_id to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_status ON conversations(user_id, status);
```

### 2. New Commands

- **`/new`** - Check if there's an active conversation and prompt to extract or discard
- **`/extract`** - Save current conversation as structured knowledge
- **`/clear`** - Discard current conversation (marks as archived in DB)
- **`/status`** - Show current conversation status

### 3. Conversation Lifecycle

**Starting a conversation:**
- Just send a message - conversation starts automatically
- Each user gets their own conversation (tracked by Telegram user ID)

**During conversation:**
- Every message is auto-saved to database
- Conversation state maintained in memory
- 5-minute inactivity timeout (configurable)

**Ending a conversation:**
- `/extract` - Extracts knowledge, saves to DB, ends conversation
- `/clear` - Discards conversation, marks as archived
- Timeout - Automatically ends after 5 minutes of inactivity

### 4. Server Restart Behavior

**Before restart:**
- Active conversations are saved to database on every message
- Conversation state (messages) persists in DB

**After restart:**
- ✅ **Lazy loading implemented**: On first message from user, bot loads their active conversation from DB
- ✅ Conversation continues seamlessly from where it left off
- ✅ Only queries DB once per user (on their first message)
- ✅ Subsequent messages use in-memory state

See `CONVERSATION_PERSISTENCE.md` for detailed implementation.

### 5. Multi-User Support

✅ **Already supported!**
- Each Telegram user gets their own conversation
- User ID from Telegram is stored in database
- Conversations are isolated per user

## Usage Examples

### Starting a new conversation when one exists:
```
You: /new
Bot: You have an active conversation with 8 messages.
     What would you like to do?
     • /extract - Save this conversation as knowledge
     • /clear - Discard and start fresh

You: /extract
Bot: Extracting knowledge from our conversation...
Bot: ✅ Knowledge extracted and saved!

You: Now I can start a fresh conversation
```

### Checking status:
```
You: /status
Bot: 📊 Status
     
     Conversation: 🟢 Active
     Messages: 12
     ID: cfbc45ea-dd9a-42df-ae09-eb2a674015ef
```

### Clearing conversation:
```
You: /clear
Bot: ✅ Conversation cleared. Start a new one anytime!
```

## Database Schema

conversations table now has:
- `id` - UUID
- `user_id` - Telegram user ID (TEXT)
- `started_at` - Timestamp
- `raw_transcript` - Full conversation text
- `status` - active | extracted | archived
- `quality_rating` - 1-5 (nullable)
- `created_at` - Timestamp
- `updated_at` - Auto-updated timestamp

## Implementation Notes

1. **Conversation updates on every message** - Each user message and bot response triggers a DB update
2. **User isolation** - Telegram user ID ensures conversations don't mix
3. **Graceful degradation** - If DB save fails, conversation continues in memory
4. **Status tracking** - `active` → `extracted` or `archived` based on user action
