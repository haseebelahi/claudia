# System Prompts - Assistant Self-Awareness

## Overview

The assistant has been made **self-aware** - it knows what it is, why it exists, and what you're building.

## What the Assistant Knows

### About Itself
- It's a personal knowledge extraction assistant
- It lives in Telegram
- Built using Claude/LLMs via OpenRouter, OpenAI embeddings, and Supabase
- It's model-agnostic (can be swapped via Vercel AI SDK)
- Its conversations get stored as structured knowledge with embeddings

### About You
- Software engineer with 8+ years of experience
- Interested in: tech, science, personal finance, investing
- Building a personal knowledge system ("personal operating system")
- Wants to capture learnings from work, hobbies, and life

### About the Project
- **Phase 1 (current)**: Core extraction loop - capture knowledge through conversation
- **Future phases**: 
  - Semantic search with `/recall`
  - Passive data ingestion (browser history, GitHub, bookmarks)
  - Content synthesis (LinkedIn posts, blog topics, tech talks)

### Its Purpose
- Extract what you've **learned**, not just what you've seen
- Help articulate problem → solution patterns
- Capture insights, decisions, and key takeaways
- Store knowledge in searchable, structured format

## Conversation System Prompt

The assistant knows:
- Its role as a knowledge extraction tool
- The tech stack it's built on
- Your background and goals
- How to guide conversations toward extractable knowledge
- When to suggest using `/extract`
- That you're actively building it (meta-awareness!)

## Extraction System Prompt

The extractor knows:
- Your profile (8+ years SWE, multiple interests)
- The 4 types of knowledge: problem_solution, insight, decision, learning
- How to generate useful tags (lowercase, underscores)
- How to extract actionable learnings

## Benefits of Self-Awareness

1. **Better context** - Knows what kind of knowledge you value
2. **Smarter questions** - Can probe for technical details when relevant
3. **Meta-conversations** - Can discuss the system you're building
4. **Appropriate tone** - Knows you're technical, keeps it casual
5. **Command awareness** - Can suggest `/extract` when ready

## Example Conversations

### Before (generic):
```
You: I fixed a bug today
Bot: That's great! What was the bug?
```

### After (self-aware):
```
You: I fixed a bug today
Bot: Nice! What was the issue? And what did you learn that you'd want to remember for next time?
(Guides toward extractable knowledge)
```

### Meta conversation:
```
You: I'm adding a /recall command to you
Bot: Oh interesting! So I'll be able to search through past knowledge entries? 
     That'll complete the extraction → retrieval loop. What are you thinking 
     for the search interface?
```

## Updating the Prompts

Prompts are in `src/services/llm.service.ts`:
- `CONVERSATION_SYSTEM_PROMPT` - Main conversation personality
- `EXTRACTION_SYSTEM_PROMPT` - Knowledge extraction rules

Feel free to update these as you refine what you want the assistant to be!

## Future Enhancements

Consider adding to the system prompt:
- Your specific interests (languages, frameworks, domains)
- Communication preferences
- Knowledge domains you care most about
- Examples of good vs. bad extractions
- Your content goals (LinkedIn style, blog style, etc.)
