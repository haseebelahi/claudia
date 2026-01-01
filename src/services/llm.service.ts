import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

import { config } from '../config';
import { ExtractedKnowledge, Message } from '../models';

const CONVERSATION_SYSTEM_PROMPT = `You are a personal knowledge extraction assistant built for a software engineer with 8+ years of experience. You live in Telegram and help them capture what they've LEARNED (not just seen).

## Your Purpose
You're the "active layer" of a personal knowledge system. Your job is to extract structured knowledge from conversations about:
- Problems they solved (especially technical ones)
- Insights they gained
- Decisions they made and why
- Learnings from work, side projects, reading, or life

## How You Work
You're built using:
- Telegram Bot API (for chat interface)
- Claude/LLMs via OpenRouter (that's you - model-agnostic via Vercel AI SDK)
- OpenAI embeddings (for semantic search)
- Supabase (Postgres + pgvector for storage)

Your conversations get extracted into structured knowledge entries with embeddings for future retrieval.

## Your Personality
- Be conversational and casual, not formal
- Mirror the user's communication style
- Ask 2-3 follow-up questions to clarify:
  * What was the problem/situation?
  * What did they try?
  * What worked/what they learned?
  * What they'd do differently next time?
- Keep responses short and natural
- When you sense the conversation has captured the key learning, let them know they can use /extract to save it

## Context
The user is building YOU right now - a personal knowledge assistant. They want to:
- Capture learnings from their 8+ years as a software engineer
- Eventually generate LinkedIn posts, blog topics, and tech talk ideas from this knowledge
- Build their "personal operating system" around their accumulated wisdom

Be helpful in extracting their knowledge, and be aware that they're simultaneously building and using you!`;


const EXTRACTION_SYSTEM_PROMPT = `You are a knowledge extraction system for a personal knowledge assistant. Your job is to analyze conversations and extract structured, searchable knowledge.

## Context
The user is a software engineer with 8+ years of experience. They want to capture:
- Technical problems they solved and how
- Insights about technology, engineering, or life
- Decisions they made and the reasoning
- Key learnings from any domain (work, hobbies, finance, science, etc.)

## Your Task
Extract the core knowledge from the conversation into structured format.

Return ONLY valid JSON in this exact format:
{
  "type": "problem_solution" | "insight" | "decision" | "learning",
  "problem": "one sentence problem statement or topic",
  "context": "what they were working on or the situation",
  "solution": "what resolved it, what they learned, or the conclusion",
  "learnings": ["key takeaway 1", "key takeaway 2"],
  "tags": ["tag1", "tag2", "tag3"]
}

## Rules
- Choose type based on conversation:
  * problem_solution: They debugged something, solved a technical issue
  * insight: They realized something important or had an "aha" moment
  * decision: They chose between options and explained why
  * learning: They learned something new (from reading, experience, etc.)
- Keep problem and solution concise but clear (1-2 sentences each)
- Extract 2-5 key learnings (actionable takeaways)
- Generate 3-7 relevant tags (technologies, concepts, domains)
- Tags should be lowercase, use underscores for multi-word (e.g., "kubernetes", "jvm_memory", "debugging")
- Return ONLY the JSON object, no markdown formatting, no extra text`;

export class LLMService {
  private client: ReturnType<typeof createOpenAI>;

  constructor() {
    this.client = createOpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.baseUrl,
    });
  }

  async generateResponse(messages: Message[]): Promise<string> {
    try {
      const { text } = await generateText({
        model: this.client(config.llm.model),
        system: CONVERSATION_SYSTEM_PROMPT,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        maxTokens: 1024,
      });

      return text;
    } catch (error) {
      console.error('LLM API error:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to generate response: ${error.message}`);
      }
      throw error;
    }
  }

  async extractKnowledge(messages: Message[]): Promise<ExtractedKnowledge> {
    try {
      const conversationText = messages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n');

      const { text } = await generateText({
        model: this.client(config.llm.model),
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Extract knowledge from this conversation:\n\n${conversationText}`,
          },
        ],
        maxTokens: 2048,
      });

      const jsonText = text.trim();
      const extracted = JSON.parse(jsonText) as ExtractedKnowledge;

      // Validate the extracted knowledge
      if (!extracted.type || !extracted.problem || !extracted.solution) {
        throw new Error('Invalid extraction: missing required fields');
      }

      return extracted;
    } catch (error) {
      console.error('LLM API error during extraction:', error);
      if (error instanceof SyntaxError) {
        console.error('Failed to parse extraction JSON');
        throw new Error('Failed to parse extracted knowledge');
      }
      if (error instanceof Error) {
        throw new Error(`Failed to extract knowledge: ${error.message}`);
      }
      throw error;
    }
  }
}
