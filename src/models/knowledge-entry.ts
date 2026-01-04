// Types from conversation extraction
export type ConversationEntryType = 'problem_solution' | 'insight' | 'decision' | 'learning';

// Types from /remember command
export type RememberEntryType = 'fact' | 'preference' | 'event' | 'relationship' | 'goal';

// Future types from /read and /research commands
export type ContentEntryType = 'article_summary' | 'research';

// All entry types
export type EntryType = ConversationEntryType | RememberEntryType | ContentEntryType;

export interface KnowledgeEntry {
  id: string;
  conversationId: string | null;
  userId: string | null;
  type: EntryType;
  problem: string;
  context: string | null;
  solution: string;
  learnings: string[];
  tags: string[];
  embedding?: number[];
  createdAt: Date;
  decayWeight: number;
}

export interface KnowledgeEntryInsert {
  conversationId?: string | null;
  userId?: string | null;
  type: EntryType;
  problem: string;
  context?: string | null;
  solution: string;
  learnings?: string[];
  tags?: string[];
  embedding?: number[];
  decayWeight?: number;
}

export interface ExtractedKnowledge {
  type: ConversationEntryType;
  problem: string;
  context: string;
  solution: string;
  learnings: string[];
  tags: string[];
}

// Categorization result from LLM for /remember command
export interface CategorizationResult {
  type: RememberEntryType;
  summary: string;  // Brief summary of the fact for storage
  tags: string[];
}

export interface KnowledgeSearchResult extends KnowledgeEntry {
  similarity: number;
}
