export type EntryType = 'problem_solution' | 'insight' | 'decision' | 'learning';

export interface KnowledgeEntry {
  id: string;
  conversationId: string | null;
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
  type: EntryType;
  problem: string;
  context: string;
  solution: string;
  learnings: string[];
  tags: string[];
}

export interface KnowledgeSearchResult extends KnowledgeEntry {
  similarity: number;
}
