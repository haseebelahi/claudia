// =============================================================================
// LEGACY TYPES (Phase 1/2A - kept for backward compatibility during migration)
// =============================================================================

// Types from conversation extraction
export type ConversationEntryType = 'problem_solution' | 'insight' | 'decision' | 'learning';

// Types from /remember command
export type RememberEntryType = 'fact' | 'preference' | 'event' | 'relationship' | 'goal';

// Future types from /read and /research commands
export type ContentEntryType = 'article_summary' | 'research';

// All entry types
export type EntryType = ConversationEntryType | RememberEntryType | ContentEntryType;

// =============================================================================
// THOUGHT MODEL v1 (Phase 2.5+)
// =============================================================================

// Thought kinds - the type of knowledge being captured
export type ThoughtKind =
  | 'heuristic'   // "When X, do Y" - fixes, techniques, workarounds
  | 'lesson'      // "I learned that..." - reflections on experience
  | 'decision'    // "I chose X because..." - choices with rationale
  | 'observation' // "I noticed..." - patterns, trends
  | 'principle'   // "Always/never do X" - firm rules
  | 'fact'        // "X is true" - information, dates, data
  | 'preference'  // "I prefer X" - personal choices
  | 'feeling'     // "I feel X when Y" - emotional patterns
  | 'goal'        // "I want to X" - aspirations
  | 'prediction'; // "I expect X will..." - forecasts

// Domain classification
export type ThoughtDomain = 'professional' | 'personal' | 'mixed';

// Stance on the claim
export type ThoughtStance = 'believe' | 'tentative' | 'question' | 'rejected';

// Privacy level for synthesis/sharing
export type ThoughtPrivacy = 'private' | 'sensitive' | 'shareable';

// A single extracted thought
export interface ExtractedThought {
  kind: ThoughtKind;
  domain: ThoughtDomain;
  claim: string;           // 1-2 sentence standalone statement
  stance: ThoughtStance;
  confidence: number;      // 0.0-1.0
  context?: string;        // When/where this applies
  evidence?: string[];     // Supporting points
  examples?: string[];     // Concrete examples
  actionables?: string[];  // What to do next
  tags: string[];
}

// Result from thought extraction (can yield multiple thoughts)
export interface ThoughtExtractionResult {
  thoughts: ExtractedThought[];
}

// Thought as stored in database (with metadata)
export interface Thought extends ExtractedThought {
  id: string;
  userId: string;
  privacy: ThoughtPrivacy;
  supersedes_id?: string | null;
  superseded_by_id?: string | null;
  related_ids?: string[];
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

// For inserting a new thought
export interface ThoughtInsert {
  userId: string;
  kind: ThoughtKind;
  domain: ThoughtDomain;
  claim: string;
  stance: ThoughtStance;
  confidence: number;
  privacy?: ThoughtPrivacy;
  context?: string;
  evidence?: string[];
  examples?: string[];
  actionables?: string[];
  tags: string[];
  supersedes_id?: string | null;
  related_ids?: string[];
  embedding?: number[];
}

// Source types for thought provenance
export type SourceType = 'conversation' | 'article' | 'research' | 'manual';

// Source record (raw input that thoughts are derived from)
export interface Source {
  id: string;
  userId: string;
  type: SourceType;
  title?: string;
  raw: string;            // Full transcript/article text
  summary?: string;
  url?: string;
  metadata?: Record<string, unknown>;
  capturedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// For inserting a new source
export interface SourceInsert {
  userId: string;
  type: SourceType;
  title?: string;
  raw: string;
  summary?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

// Thought-source link (many-to-many with optional quote)
export interface ThoughtSource {
  thoughtId: string;
  sourceId: string;
  quoted?: string;
}

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
