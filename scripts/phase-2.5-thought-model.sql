-- Phase 2.5: Thought Model v1 Schema
-- Run this in your Supabase SQL editor
--
-- This script:
-- 1. Creates new tables (sources, thoughts, thought_sources)
-- 2. Migrates existing data (conversations → sources, knowledge_entries → thoughts)
-- 3. Creates vector search function for thoughts

-- =============================================================================
-- STEP 1: Create new tables
-- =============================================================================

-- Sources table: raw inputs (conversation transcripts, articles, research)
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('conversation', 'article', 'research', 'manual')),
    title TEXT,
    raw TEXT NOT NULL,
    summary TEXT,
    url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Thoughts table: atomic, standalone claims derived from sources
CREATE TABLE thoughts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,

    -- Classification
    kind TEXT NOT NULL CHECK (kind IN (
        'heuristic', 'lesson', 'decision', 'observation', 'principle',
        'fact', 'preference', 'feeling', 'goal', 'prediction'
    )),
    domain TEXT NOT NULL CHECK (domain IN ('personal', 'professional', 'mixed')),
    privacy TEXT DEFAULT 'private' CHECK (privacy IN ('private', 'sensitive', 'shareable')),

    -- Core content
    claim TEXT NOT NULL,
    stance TEXT NOT NULL CHECK (stance IN ('believe', 'tentative', 'question', 'rejected')),
    confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),

    -- Supporting details
    context TEXT,
    evidence TEXT[] DEFAULT '{}',
    examples TEXT[] DEFAULT '{}',
    actionables TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',

    -- Revision chain (append-only model)
    supersedes_id UUID REFERENCES thoughts(id),
    superseded_by_id UUID REFERENCES thoughts(id),
    related_ids UUID[] DEFAULT '{}',

    -- Vector embedding for semantic search
    embedding vector(1536),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table: many thoughts can be backed by many sources
CREATE TABLE thought_sources (
    thought_id UUID REFERENCES thoughts(id) ON DELETE CASCADE,
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    quoted TEXT, -- optional quoted snippet from source
    PRIMARY KEY (thought_id, source_id)
);

-- =============================================================================
-- STEP 2: Create indexes
-- =============================================================================

-- Sources indexes
CREATE INDEX idx_sources_user_id ON sources(user_id);
CREATE INDEX idx_sources_type ON sources(type);
CREATE INDEX idx_sources_captured_at ON sources(captured_at DESC);

-- Thoughts indexes
CREATE INDEX idx_thoughts_user_id ON thoughts(user_id);
CREATE INDEX idx_thoughts_kind ON thoughts(kind);
CREATE INDEX idx_thoughts_domain ON thoughts(domain);
CREATE INDEX idx_thoughts_created_at ON thoughts(created_at DESC);
CREATE INDEX idx_thoughts_tags ON thoughts USING GIN(tags);
CREATE INDEX idx_thoughts_supersedes ON thoughts(supersedes_id) WHERE supersedes_id IS NOT NULL;

-- Vector similarity search index
CREATE INDEX idx_thoughts_embedding ON thoughts
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- STEP 3: Create search function
-- =============================================================================

-- Vector similarity search for thoughts
CREATE OR REPLACE FUNCTION match_thoughts(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10,
    filter_user_id text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    user_id text,
    kind text,
    domain text,
    claim text,
    stance text,
    confidence float,
    context text,
    evidence text[],
    actionables text[],
    tags text[],
    created_at timestamp with time zone,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        thoughts.id,
        thoughts.user_id,
        thoughts.kind,
        thoughts.domain,
        thoughts.claim,
        thoughts.stance,
        thoughts.confidence,
        thoughts.context,
        thoughts.evidence,
        thoughts.actionables,
        thoughts.tags,
        thoughts.created_at,
        1 - (thoughts.embedding <=> query_embedding) as similarity
    FROM thoughts
    WHERE thoughts.embedding IS NOT NULL
        AND thoughts.superseded_by_id IS NULL  -- Only return latest version
        AND 1 - (thoughts.embedding <=> query_embedding) > match_threshold
        AND (filter_user_id IS NULL OR thoughts.user_id = filter_user_id)
    ORDER BY thoughts.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =============================================================================
-- STEP 4: Create triggers
-- =============================================================================

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_thoughts_updated_at BEFORE UPDATE ON thoughts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- STEP 5: Migrate existing data
-- =============================================================================

-- Migrate conversations → sources
INSERT INTO sources (id, user_id, type, title, raw, captured_at, created_at, updated_at)
SELECT
    id,
    COALESCE(user_id, 'default'),
    'conversation',
    'Conversation ' || TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI'),
    COALESCE(raw_transcript, ''),
    COALESCE(started_at, created_at),
    created_at,
    updated_at
FROM conversations
WHERE raw_transcript IS NOT NULL AND raw_transcript != '';

-- Migrate knowledge_entries → thoughts
-- This maps old types to new kinds
INSERT INTO thoughts (
    user_id, kind, domain, claim, stance, confidence,
    context, actionables, tags, embedding, created_at
)
SELECT
    COALESCE(ke.user_id, 'default'),
    CASE ke.type
        WHEN 'problem_solution' THEN 'heuristic'
        WHEN 'insight' THEN 'observation'
        WHEN 'decision' THEN 'decision'
        WHEN 'learning' THEN 'lesson'
        WHEN 'fact' THEN 'fact'
        WHEN 'preference' THEN 'preference'
        WHEN 'event' THEN 'fact'
        WHEN 'relationship' THEN 'fact'
        WHEN 'goal' THEN 'goal'
        ELSE 'observation'
    END,
    'professional', -- Default domain, can be updated later
    -- Create claim from problem + solution
    CASE
        WHEN ke.problem IS NOT NULL AND ke.solution IS NOT NULL
        THEN LEFT(ke.problem || ' → ' || ke.solution, 500)
        WHEN ke.problem IS NOT NULL THEN ke.problem
        ELSE ke.solution
    END,
    'believe',
    0.8, -- Default confidence
    ke.context,
    COALESCE(ke.learnings, '{}'),
    COALESCE(ke.tags, '{}'),
    ke.embedding,
    ke.created_at
FROM knowledge_entries ke;

-- Link migrated thoughts to their source conversations
INSERT INTO thought_sources (thought_id, source_id)
SELECT t.id, s.id
FROM thoughts t
JOIN knowledge_entries ke ON t.claim LIKE '%' || LEFT(ke.problem, 50) || '%'
JOIN sources s ON s.id = ke.conversation_id
WHERE ke.conversation_id IS NOT NULL;

-- =============================================================================
-- STEP 6: Verify migration
-- =============================================================================

-- Run these queries to verify the migration worked:
-- SELECT COUNT(*) as source_count FROM sources;
-- SELECT COUNT(*) as thought_count FROM thoughts;
-- SELECT kind, COUNT(*) FROM thoughts GROUP BY kind;

-- =============================================================================
-- Optional: Archive old tables (uncomment when ready)
-- =============================================================================

-- Rename old tables to archive
-- ALTER TABLE conversations RENAME TO conversations_archive;
-- ALTER TABLE knowledge_entries RENAME TO knowledge_entries_archive;

-- Or drop them entirely (only after confirming migration is correct!)
-- DROP TABLE knowledge_entries;
-- DROP TABLE conversations;
