import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

import { config } from '../config';
import {
  CategorizationResult,
  ExtractedKnowledge,
  ExtractedThought,
  ThoughtExtractionResult,
  ThoughtKind,
  Message,
} from '../models';

const CONVERSATION_SYSTEM_PROMPT = `You are a personal knowledge extraction assistant. Your job is to help capture learnings as standalone, retrievable thoughts through focused conversation.

## Your User
- Software engineer with 8+ years experience
- Interests: tech, science, personal finance, investing
- Goal: Build a "second brain" for idea generation and memory retrieval
- Captures both professional AND personal knowledge

## Extraction Goal
Each conversation should yield 1-N THOUGHTS. A thought is:
- A standalone CLAIM (1-2 sentences, readable without the conversation)
- Classified by KIND (heuristic, lesson, decision, observation, principle, fact, preference, feeling, goal, prediction)
- Tagged and linked to this conversation as its source

## Conversation Strategy

### Step 1: Identify the kind from the opener
Listen for signals:
- "I just fixed..." / "I debugged..." → heuristic
- "I realized..." / "I learned..." → lesson
- "I decided..." / "I chose..." → decision
- "I noticed..." / "I've been seeing..." → observation
- "I think..." / "I believe..." → principle or observation
- "I prefer..." / "I like..." → preference
- "I feel..." → feeling
- "I want to..." / "My goal is..." → goal

### Step 2: Ask targeted follow-ups (2-3 max)

FOR HEURISTIC (debugging/fix):
- "What was the symptom or error?"
- "What was the root cause?"
- "What's the fix?" (skip if already stated)

FOR LESSON (learning from experience):
- "What happened?"
- "What's the takeaway?"
- "What will you do differently?"

FOR DECISION:
- "What were the options?"
- "What made you choose this one?"

FOR OBSERVATION:
- "Where have you seen this?"
- "What do you think it means?"

FOR PREFERENCE/FEELING:
- "Why this preference?" or "What triggers this feeling?"
- "Any exceptions?"

FOR GOAL:
- "Why does this matter to you?"
- "What's the first step?"

### Step 3: Crystallize (only if needed)
If the claim isn't already clear, reflect it back:
- "So the key point is: [draft claim]. Sound right?"

### Step 4: Signal completion
When you have enough:
- "Got it. Use /extract when ready, or keep going if there's more."

## Rules
- SHORT responses (1-3 sentences)
- NEVER ask generic questions ("tell me more", "anything else?")
- NEVER repeat back information already given
- SKIP questions whose answers were already provided
- Stay casual, mirror user's tone
- If multiple distinct thoughts emerge, that's fine - extraction will capture all of them`;


const EXTRACTION_SYSTEM_PROMPT = `Extract 1-N structured THOUGHTS from this conversation. Return ONLY valid JSON.

## Output Format
{
  "thoughts": [
    {
      "kind": "heuristic|lesson|decision|observation|principle|fact|preference|feeling|goal|prediction",
      "domain": "professional|personal|mixed",
      "claim": "1-2 sentence standalone statement",
      "stance": "believe|tentative|question",
      "confidence": 0.0-1.0,
      "context": "When/where this applies (1-2 sentences, optional)",
      "evidence": ["Supporting point 1", "..."],
      "actionables": ["What to do next", "..."],
      "tags": ["lowercase", "underscore_separated"]
    }
  ]
}

## Kind Selection
| Kind | Use when... |
|------|-------------|
| heuristic | "When X, do Y" - fixes, techniques, workarounds |
| lesson | "I learned that..." - reflections on experience |
| decision | "I chose X because..." - choices with rationale |
| observation | "I noticed..." - patterns, trends |
| principle | "Always/never do X" - firm rules |
| fact | "X is true" - information, dates, data |
| preference | "I prefer X" - personal choices |
| feeling | "I feel X when Y" - emotional patterns |
| goal | "I want to X" - aspirations |
| prediction | "I expect X will..." - forecasts |

## Claim Rules
- MUST be standalone (no "this", "that", "the issue" without context)
- MUST be specific (not "debugging is hard" but "JVM ignores container limits without UseContainerSupport")
- 1-2 sentences max
- Written as a statement, not a question

## Field Rules
- confidence: 0.9+ verified, 0.7-0.9 strong belief, 0.5-0.7 tentative
- evidence: Only if explicitly discussed in conversation
- actionables: Only if there's a clear "do this next time"
- tags: 3-7 tags, lowercase, underscores for multi-word
- Extract ALL distinct thoughts from the conversation (typically 1-3)

## Domain Selection
- professional: Work, tech, career
- personal: Life, relationships, hobbies, health, finance
- mixed: Overlaps both

Return ONLY the JSON object, no markdown formatting, no extra text.`;

const CATEGORIZATION_SYSTEM_PROMPT = `Categorize this quick note as a THOUGHT. Return ONLY valid JSON.

## Output Format
{
  "kind": "fact|preference|feeling|goal|observation",
  "domain": "professional|personal|mixed",
  "claim": "Rewritten as standalone statement (1-2 sentences)",
  "stance": "believe|tentative",
  "confidence": 0.7-1.0,
  "tags": ["tag1", "tag2"]
}

## Kind Selection for /remember
- fact: Information, dates, numbers, events, people ("Python 3.12 released Oct 2023", "Mom's birthday is March 15", "John is my manager")
- preference: Personal choices ("I prefer Delta for domestic flights")
- feeling: Emotional patterns ("I feel drained after long meetings")
- goal: Aspirations ("Learn Rust this year")
- observation: Noticed patterns ("Morning is my most productive time")

## Domain Selection
- professional: Work, tech, career related
- personal: Life, relationships, hobbies, health, finance
- mixed: Overlaps both

## Rules
- Rewrite input as a clear, standalone claim
- Keep claim concise but complete
- Tags: 2-5, lowercase, underscores for multi-word
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

  /**
   * Extract thoughts from a conversation (Thought Model v1)
   * Returns 1-N thoughts extracted from the conversation
   */
  async extractThoughts(messages: Message[]): Promise<ThoughtExtractionResult> {
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
            content: `Extract thoughts from this conversation:\n\n${conversationText}`,
          },
        ],
        maxTokens: 2048,
      });

      const jsonText = text.trim();
      const result = JSON.parse(jsonText) as ThoughtExtractionResult;

      // Validate the extraction result
      if (!result.thoughts || !Array.isArray(result.thoughts) || result.thoughts.length === 0) {
        throw new Error('Invalid extraction: no thoughts extracted');
      }

      // Validate each thought
      const validKinds: ThoughtKind[] = [
        'heuristic', 'lesson', 'decision', 'observation', 'principle',
        'fact', 'preference', 'feeling', 'goal', 'prediction'
      ];

      for (const thought of result.thoughts) {
        if (!thought.kind || !validKinds.includes(thought.kind)) {
          throw new Error(`Invalid thought kind: ${thought.kind}`);
        }
        if (!thought.claim) {
          throw new Error('Invalid thought: missing claim');
        }
        if (!thought.tags) {
          thought.tags = [];
        }
        if (!thought.evidence) {
          thought.evidence = [];
        }
        if (!thought.actionables) {
          thought.actionables = [];
        }
      }

      return result;
    } catch (error) {
      console.error('LLM API error during thought extraction:', error);
      if (error instanceof SyntaxError) {
        console.error('Failed to parse extraction JSON');
        throw new Error('Failed to parse extracted thoughts');
      }
      if (error instanceof Error) {
        throw new Error(`Failed to extract thoughts: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Categorize a quick note as a thought (for /remember command)
   * Returns a single thought
   */
  async categorizeAsThought(fact: string): Promise<ExtractedThought> {
    try {
      const { text } = await generateText({
        model: this.client(config.llm.model),
        system: CATEGORIZATION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Categorize this note:\n\n${fact}`,
          },
        ],
        maxTokens: 512,
      });

      const jsonText = text.trim();
      const result = JSON.parse(jsonText) as ExtractedThought;

      // Validate the result
      const validKinds: ThoughtKind[] = ['fact', 'preference', 'feeling', 'goal', 'observation'];
      if (!result.kind || !validKinds.includes(result.kind)) {
        throw new Error(`Invalid thought kind: ${result.kind}`);
      }
      if (!result.claim) {
        throw new Error('Invalid categorization: missing claim');
      }

      // Ensure arrays exist
      if (!result.tags) {
        result.tags = [];
      }

      // Set defaults for optional fields
      if (!result.stance) {
        result.stance = 'believe';
      }
      if (!result.confidence) {
        result.confidence = 0.8;
      }
      if (!result.domain) {
        result.domain = 'personal';
      }

      return result;
    } catch (error) {
      console.error('LLM API error during thought categorization:', error);
      if (error instanceof SyntaxError) {
        console.error('Failed to parse categorization JSON');
        throw new Error('Failed to parse categorization result');
      }
      if (error instanceof Error) {
        throw new Error(`Failed to categorize as thought: ${error.message}`);
      }
      throw error;
    }
  }

  // ===========================================================================
  // LEGACY METHODS (kept for backward compatibility during migration)
  // ===========================================================================

  /**
   * @deprecated Use extractThoughts() instead. This method uses the old schema.
   */
  async extractKnowledge(messages: Message[]): Promise<ExtractedKnowledge> {
    // For backward compatibility, extract thoughts and convert to old format
    const result = await this.extractThoughts(messages);
    const thought = result.thoughts[0]; // Take the first thought

    // Map new kinds to old types
    const kindToType: Record<ThoughtKind, ExtractedKnowledge['type']> = {
      heuristic: 'problem_solution',
      lesson: 'learning',
      decision: 'decision',
      observation: 'insight',
      principle: 'insight',
      fact: 'learning',
      preference: 'learning',
      feeling: 'insight',
      goal: 'learning',
      prediction: 'insight',
    };

    return {
      type: kindToType[thought.kind] || 'learning',
      problem: thought.claim,
      context: thought.context || '',
      solution: thought.claim, // In the new model, claim contains the key insight
      learnings: thought.actionables || [],
      tags: thought.tags,
    };
  }

  /**
   * @deprecated Use categorizeAsThought() instead. This method uses the old schema.
   */
  async categorizeFact(fact: string): Promise<CategorizationResult> {
    // For backward compatibility, categorize as thought and convert to old format
    const thought = await this.categorizeAsThought(fact);

    // Map new kinds to old types
    const kindToType: Record<string, CategorizationResult['type']> = {
      fact: 'fact',
      preference: 'preference',
      feeling: 'goal', // closest match
      goal: 'goal',
      observation: 'fact',
    };

    return {
      type: kindToType[thought.kind] || 'fact',
      summary: thought.claim,
      tags: thought.tags,
    };
  }
}
