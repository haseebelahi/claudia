# System Prompts - Thought Model v1

## Overview

The assistant uses three specialized prompts to guide conversation, extraction, and categorization. As of Phase 2.5, all prompts output the **Thought Model v1** format.

## Prompt Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CONVERSATION PROMPT                       │
│                                                              │
│  Purpose: Guide conversation toward extractable thoughts    │
│  Output: Natural language responses                          │
│  Strategy: Surgical questions based on thought kind         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXTRACTION PROMPT                         │
│                                                              │
│  Purpose: Extract structured thoughts from conversation     │
│  Output: JSON with 1-N ExtractedThought objects             │
│  Trigger: /extract command                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  CATEGORIZATION PROMPT                       │
│                                                              │
│  Purpose: Categorize quick notes as thoughts                │
│  Output: JSON with single ExtractedThought object           │
│  Trigger: /remember command                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Thought Model v1 - Core Concepts

### What is a Thought?

A **thought** is the atomic unit of knowledge in this system:
- **Standalone**: Readable without the original conversation
- **Composable**: Can be combined into frameworks, posts, talks
- **Traceable**: Links back to source (conversation, article, etc.)
- **Append-only**: Never edited, only superseded

### Thought Kinds

| Kind | Description | Example |
|------|-------------|---------|
| `heuristic` | "When X, do Y" - fixes, techniques | "When JVM memory looks wrong in K8s, check UseContainerSupport first" |
| `lesson` | Reflections on experience | "I learned that code reviews are more effective in small batches" |
| `decision` | Choices with rationale | "I chose TypeScript over JavaScript for type safety in large codebases" |
| `observation` | Patterns, trends noticed | "I notice I'm more productive when I batch similar tasks" |
| `principle` | Firm rules or beliefs | "Always write tests before refactoring" |
| `fact` | Information, dates, data | "Python 3.12 was released in October 2023" |
| `preference` | Personal choices | "I prefer Delta for domestic flights" |
| `feeling` | Emotional patterns | "I feel burnt out when context-switching too much" |
| `goal` | Aspirations | "I want to learn Rust this year" |
| `prediction` | Forecasts | "I expect AI coding assistants to become standard by 2027" |

### Other Fields

| Field | Type | Description |
|-------|------|-------------|
| `domain` | `professional \| personal \| mixed` | Classification of the thought |
| `claim` | string | 1-2 sentence standalone statement |
| `stance` | `believe \| tentative \| question \| rejected` | Confidence in the claim |
| `confidence` | 0.0-1.0 | Numerical confidence |
| `context` | string | When/where this applies |
| `evidence` | string[] | Supporting points |
| `actionables` | string[] | What to do next |
| `tags` | string[] | 3-7 lowercase, underscore-separated |

---

## Prompt 1: Conversation

### Purpose
Guide conversations toward extractable thoughts using **surgical, targeted questions** based on the identified thought kind.

### Strategy

1. **Identify kind from opener** - Listen for signals:
   - "I just fixed..." → heuristic
   - "I realized..." → lesson
   - "I decided..." → decision
   - etc.

2. **Ask targeted follow-ups (2-3 max)** - Kind-specific:
   - **Heuristic**: "What was the symptom?", "What was the root cause?", "What's the fix?"
   - **Lesson**: "What happened?", "What's the takeaway?", "What will you do differently?"
   - **Decision**: "What were the options?", "What made you choose this one?"
   - etc.

3. **Crystallize** (if needed) - Reflect the claim back for confirmation

4. **Signal completion** - "Got it. Use /extract when ready."

### Anti-patterns

- NEVER ask generic questions ("tell me more", "anything else?")
- NEVER repeat information already given
- NEVER drag out conversations unnecessarily

### Location

`src/services/llm.service.ts` - `CONVERSATION_SYSTEM_PROMPT`

---

## Prompt 2: Extraction

### Purpose
Extract 1-N structured thoughts from a conversation.

### Output Format

```json
{
  "thoughts": [
    {
      "kind": "heuristic",
      "domain": "professional",
      "claim": "JVM ignores container memory limits unless UseContainerSupport is explicitly set",
      "stance": "believe",
      "confidence": 0.9,
      "context": "Applies to JVM services in Kubernetes with older base images",
      "evidence": ["Saw repeated OOMKilled despite generous limits"],
      "actionables": ["Standardize base images to JVM 17+"],
      "tags": ["kubernetes", "jvm", "debugging", "memory"]
    }
  ]
}
```

### Claim Writing Rules

- **Standalone**: No "this", "that", "the issue" without context
- **Specific**: Not "debugging is hard" but "JVM ignores container limits without UseContainerSupport"
- **1-2 sentences max**
- **Written as a statement**, not a question

### Location

`src/services/llm.service.ts` - `EXTRACTION_SYSTEM_PROMPT`

---

## Prompt 3: Categorization

### Purpose
Categorize quick notes (via `/remember`) as single thoughts.

### Supported Kinds

For `/remember`, only these kinds are available:
- `fact` - Information, dates, numbers, events, people
- `preference` - Personal choices
- `feeling` - Emotional patterns
- `goal` - Aspirations
- `observation` - Noticed patterns

### Output Format

```json
{
  "kind": "preference",
  "domain": "personal",
  "claim": "I prefer Delta for domestic flights due to their reliability",
  "stance": "believe",
  "confidence": 0.9,
  "tags": ["travel", "airlines", "preferences"]
}
```

### Location

`src/services/llm.service.ts` - `CATEGORIZATION_SYSTEM_PROMPT`

---

## Code Reference

### New Methods (Thought Model v1)

```typescript
// Extract 1-N thoughts from conversation
llm.extractThoughts(messages): Promise<ThoughtExtractionResult>

// Categorize a quick note as a thought
llm.categorizeAsThought(fact): Promise<ExtractedThought>
```

### Legacy Methods (Deprecated)

```typescript
// @deprecated - Use extractThoughts() instead
llm.extractKnowledge(messages): Promise<ExtractedKnowledge>

// @deprecated - Use categorizeAsThought() instead
llm.categorizeFact(fact): Promise<CategorizationResult>
```

Legacy methods internally call the new methods and convert the output to the old format for backward compatibility.

---

## User Context

The prompts are aware of:
- Software engineer with 8+ years experience
- Interests: tech, science, personal finance, investing
- Goal: Build a "second brain" for idea generation and memory retrieval
- Captures both professional AND personal knowledge

---

## Updating the Prompts

Prompts are in `src/services/llm.service.ts`:
- `CONVERSATION_SYSTEM_PROMPT` - Conversation personality & strategy
- `EXTRACTION_SYSTEM_PROMPT` - Thought extraction rules
- `CATEGORIZATION_SYSTEM_PROMPT` - Quick note categorization

Types are in `src/models/knowledge-entry.ts`:
- `ThoughtKind`, `ThoughtDomain`, `ThoughtStance`, `ThoughtPrivacy`
- `ExtractedThought`, `ThoughtExtractionResult`
- `Thought`, `ThoughtInsert`, `Source`, `SourceInsert`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1 (Phase 1) | 2026-01-01 | Original prompts with problem/solution model |
| v2 (Phase 2.5) | 2026-01-05 | Thought Model v1 - surgical questions, multi-thought extraction |
