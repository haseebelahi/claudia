# Telegram Bot Commands

Complete reference for all available bot commands.

---

## 📊 Information Commands

### `/status`
Shows the current status of your active conversation.

**Output:**
- Conversation state (Active/Inactive)
- Number of messages in current conversation
- Conversation ID

**Example:**
```
📊 Status

Conversation: 🟢 Active
Messages: 12
ID: 550e8400-e29b-41d4-a716-446655440000
```

---

### `/show`
Displays the complete transcript of your current active conversation.

**Output:**
- Full conversation history with timestamps
- Message count and conversation ID
- Helpful action prompts

**Features:**
- Messages numbered sequentially
- Time stamps for each message
- Long messages truncated to 200 characters
- Shows both your messages and assistant responses

**Example:**
```
📜 Current Conversation (5 messages)
ID: 550e8400-e29b-41d4-a716-446655440000

1. 👤 You (2:30 PM)
How do I implement retry logic in TypeScript?

2. 🤖 Assistant (2:30 PM)
Here's a simple retry implementation with exponential backoff...

💡 Use /extract to save this conversation as knowledge
🗑 Use /clear to discard this conversation
```

**When to use:**
- Review what you've discussed
- Check conversation length before extracting
- Verify important details before clearing

---

### `/history`
Lists all your previous conversations that haven't been extracted yet.

**Output:**
- List of all active and archived conversations
- Message count for each conversation
- Last updated timestamp
- Conversation preview (first message)
- Conversation IDs for discarding

**Example:**
```
📚 Previous Conversations (2)

These conversations have not been extracted yet:

1. ACTIVE - 8 messages
   📅 Last updated: Jan 2, 2026, 2:30 PM
   🆔 ID: 550e8400-e29b-41d4-a716-446655440000
   💬 "How do I debug React hooks..."

2. ARCHIVED - 15 messages
   📅 Last updated: Jan 1, 2026, 10:15 AM
   🆔 ID: 660f9511-f30c-52e5-b827-557766551111
   💬 "What's the best way to handle errors..."

💡 To discard a conversation, use:
/discard `conversation_id`
```

**When to use:**
- Review old conversations before extracting
- Find conversations you forgot to extract
- Decide which conversations to keep or discard

---

## 🔍 Knowledge Commands

### `/recall` `[topic]`
Search your knowledge base using semantic search.

**Arguments:**
- `topic`: What you want to search for (natural language query)

**What happens:**
1. Generates an embedding from your search query
2. Searches for similar knowledge entries in your personal database
3. Returns up to 5 most relevant results with similarity scores

**Output includes:**
- Entry type (Problem & Solution, Insight, Fact, etc.)
- Similarity percentage
- Problem/summary
- Solution/answer
- Key learnings (first 2)
- Tags

**Example:**
```
You: /recall kubernetes memory issues
Bot: 🔍 Searching for "kubernetes memory issues"...

🧠 Found 2 results

1. Problem & Solution (85% match)
📅 Jan 1, 2026
📌 K8s pod getting OOMKilled despite high memory limits
💡 Upgraded to JVM 17 which has container support by default
📝 Learnings:
  • Check JVM version first for memory issues
  • JVM 17+ has better container awareness
🏷 kubernetes, jvm, memory, debugging
```

**When to use:**
- Looking for past solutions to problems
- Recalling what you learned about a topic
- Finding related knowledge before diving into something

---

### `/remember` `[what to remember]`
Quickly save a fact, preference, event, relationship, or goal without a full conversation.

**Arguments:**
- `what to remember`: The fact or information you want to save

**What happens:**
1. LLM analyzes and categorizes your input
2. Shows you the proposed category with inline buttons
3. You confirm or change the category
4. Entry is saved with embeddings for future search

**Categories:**
| Type | Description | Example |
|------|-------------|---------|
| Fact | Quick facts, data, numbers | "Python 3.12 was released October 2023" |
| Preference | Personal preferences | "I prefer Delta airlines for domestic flights" |
| Event | Important dates | "Mom's birthday is March 15" |
| Relationship | People context | "John Smith is my manager at Acme Corp" |
| Goal | Aspirations | "I want to learn Rust this year" |

**Example:**
```
You: /remember My favorite coffee shop is Blue Bottle in Hayes Valley
Bot: Analyzing what you want to remember...

📝 I'll remember this as:

Type: Preference
Summary: Favorite coffee shop is Blue Bottle in Hayes Valley
Tags: coffee, hayes_valley, san_francisco, preference

Is this correct?
[✅ Preference] [🔄 Change] [❌ Cancel]

You: [clicks ✅ Preference]
Bot: ✅ Saved!
     Type: Preference
     Summary: Favorite coffee shop is Blue Bottle in Hayes Valley
     Tags: coffee, hayes_valley, san_francisco

     Use /recall to search your knowledge later.
```

**When to use:**
- Quick facts you want to remember
- Personal preferences for future reference
- Important dates (birthdays, anniversaries)
- People and context about them
- Goals you're working toward

---

## 💾 Conversation Management Commands

### `/extract`
Extracts knowledge from your current conversation and saves it to the database.

**What happens:**
1. Saves current conversation to database
2. Uses LLM to extract key insights, problems, solutions
3. Generates embeddings for semantic search
4. Marks conversation as "extracted"
5. Ends the current conversation

**Requirements:**
- Must have an active conversation with messages
- All messages are automatically saved before extraction

**After extraction:**
- Conversation is preserved in database
- Knowledge is searchable (future feature)
- Memory is cleared after 1 hour grace period

**Example:**
```
You: /extract
Bot: Extracting knowledge from our conversation...
Bot: ✅ Knowledge extracted and saved!
```

**When to use:**
- After solving a problem
- When you've learned something valuable
- To save important decision-making context
- End of a productive discussion

---

### `/clear`
Discards your current active conversation without saving.

**What happens:**
1. Clears conversation from memory
2. Marks conversation as "archived" in database
3. Removes all message history

**Warning:** This action cannot be undone. Use `/extract` first if you want to save the conversation.

**Example:**
```
You: /clear
Bot: ✅ Conversation cleared. Start a new one anytime!
```

**When to use:**
- Conversation went off-track
- Want to start fresh
- No valuable knowledge to extract
- Testing or casual chat

---

### `/discard` `conversation_id`
Permanently deletes a specific previous conversation.

**Arguments:**
- `conversation_id`: The ID of the conversation to delete (from `/history`)

**Safety checks:**
- Only works on conversations you own
- Cannot discard extracted conversations
- Cannot discard your current active conversation (use `/clear` instead)
- Verifies conversation exists before deleting

**Example:**
```
You: /discard 550e8400-e29b-41d4-a716-446655440000
Bot: ✅ Conversation discarded successfully.
     ID: 550e8400-e29b-41d4-a716-446655440000
     
     Use /history to see your remaining conversations.
```

**When to use:**
- Clean up old conversations you don't need
- Remove test conversations
- Manage your conversation history
- Free up storage (if applicable)

**Note:** Use `/history` first to see conversation IDs.

---

### `/new`
Check status and get guidance for starting a new conversation.

**What it does:**
- Checks if you have an active conversation
- Provides options based on current state

**If you have messages:**
```
You have an active conversation with 12 messages.

What would you like to do?
• /extract - Save this conversation as knowledge
• /clear - Discard and start fresh
```

**If no conversation:**
```
No active conversation. Just start chatting!
```

**When to use:**
- Check before starting a new topic
- Get reminded of available options
- Quick status check

---

## 🤖 Usage Patterns

### Starting a Conversation
Just send a message - no command needed! The bot automatically creates a conversation.

```
You: How do I implement authentication in Express?
Bot: [responds]
```

### Typical Workflow

1. **Chat naturally** - no commands needed
   ```
   You: I'm having trouble with async/await
   Bot: [helps you]
   You: [follow-up questions]
   ```

2. **Check progress** (optional)
   ```
   You: /status
   Bot: [shows 15 messages in conversation]
   ```

3. **Review conversation** (optional)
   ```
   You: /show
   Bot: [displays full transcript]
   ```

4. **Save or discard**
   - If valuable: `/extract`
   - If not needed: `/clear`

5. **Manage history** (as needed)
   ```
   You: /history
   Bot: [shows old conversations]
   You: /discard old_conv_id
   ```

---

## 🎯 Best Practices

### When to Extract
- ✅ After solving a problem
- ✅ Learning something new
- ✅ Making important decisions
- ✅ Troubleshooting successfully

### When to Clear
- ✅ Casual conversation
- ✅ Testing the bot
- ✅ Off-topic discussions
- ✅ Conversation went wrong direction

### Managing History
- Use `/history` periodically to review old conversations
- Extract valuable old conversations before they're forgotten
- Discard test/casual conversations to keep history clean
- Active conversations stay in memory until extracted or cleared

---

## ⚙️ Smart Features

### Auto-Save
Conversations are automatically saved to database:
- Every 10 messages OR
- Every 5 minutes
- Whichever comes first

This prevents data loss while minimizing database writes.

### No Timeouts
Conversations stay active indefinitely - no 5-minute timeout!
- Step away and come back anytime
- Conversations persist across bot restarts
- You control when conversations end

### Memory Management
- Active conversation: In memory for instant access
- After extraction/clear: 1-hour grace period
- After 1 hour: Cleaned from memory (still in database)

---

## 🆘 Troubleshooting

### "No conversation to extract"
- You haven't sent any messages yet
- Start a conversation first by chatting

### "Unable to identify user"
- Bot couldn't get your Telegram user ID
- Try restarting the chat

### "Conversation not found" (discard)
- Invalid conversation ID
- Use `/history` to get valid IDs
- Check for typos in the ID

### "You can only discard your own conversations"
- The conversation belongs to another user
- Safety feature to prevent accidents

### "This is your current active conversation"
- Can't use `/discard` on active conversation
- Use `/clear` instead for current conversation

---

## 📝 Command Summary

| Command | Purpose | Arguments |
|---------|---------|-----------|
| `/status` | Show current conversation status | None |
| `/show` | Display complete conversation | None |
| `/history` | List previous conversations | None |
| `/recall` | Search knowledge base | `[topic]` |
| `/remember` | Quick-save a fact/preference/etc. | `[what to remember]` |
| `/extract` | Save conversation as knowledge | None |
| `/clear` | Discard current conversation | None |
| `/discard` | Delete specific conversation | `conversation_id` |
| `/new` | Check status / new conversation help | None |

---

**💡 Tip:** Most of the time, you don't need commands - just chat naturally and use `/extract` or `/clear` when done! Use `/recall` to find past knowledge and `/remember` for quick facts.
