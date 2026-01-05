-- Hybrid Search Migration: Full-Text Search + Vector Search
-- Run this in your Supabase SQL editor
--
-- This script:
-- 1. Adds a tsvector column to thoughts table for full-text search
-- 2. Creates a GIN index for fast text search
-- 3. Creates a trigger to auto-populate the tsvector column
-- 4. Backfills existing thoughts with tsvector data
-- 5. Creates a hybrid_match_thoughts function using RRF (Reciprocal Rank Fusion)

-- =============================================================================
-- STEP 1: Add tsvector column for full-text search
-- =============================================================================

-- Add the search_vector column
ALTER TABLE thoughts
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- =============================================================================
-- STEP 2: Create GIN index for full-text search
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_thoughts_search_vector
ON thoughts USING GIN(search_vector);

-- =============================================================================
-- STEP 3: Create function to generate tsvector from thought content
-- =============================================================================

-- This function concatenates claim, context, tags, and actionables into a searchable vector
CREATE OR REPLACE FUNCTION thoughts_generate_search_vector(
    p_claim text,
    p_context text,
    p_tags text[],
    p_actionables text[],
    p_evidence text[]
)
RETURNS tsvector
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    combined_text text;
BEGIN
    -- Combine all searchable fields with weights:
    -- A = claim (highest weight)
    -- B = context
    -- C = tags, actionables, evidence
    combined_text := COALESCE(p_claim, '');
    
    RETURN
        setweight(to_tsvector('english', COALESCE(p_claim, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(p_context, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(p_tags, ' '), '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(p_actionables, ' '), '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(p_evidence, ' '), '')), 'C');
END;
$$;

-- =============================================================================
-- STEP 4: Create trigger to auto-update search_vector on insert/update
-- =============================================================================

CREATE OR REPLACE FUNCTION thoughts_search_vector_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector := thoughts_generate_search_vector(
        NEW.claim,
        NEW.context,
        NEW.tags,
        NEW.actionables,
        NEW.evidence
    );
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS thoughts_search_vector_update ON thoughts;

CREATE TRIGGER thoughts_search_vector_update
BEFORE INSERT OR UPDATE OF claim, context, tags, actionables, evidence
ON thoughts
FOR EACH ROW
EXECUTE FUNCTION thoughts_search_vector_trigger();

-- =============================================================================
-- STEP 5: Backfill existing thoughts with search_vector
-- =============================================================================

UPDATE thoughts
SET search_vector = thoughts_generate_search_vector(
    claim,
    context,
    tags,
    actionables,
    evidence
)
WHERE search_vector IS NULL;

-- =============================================================================
-- STEP 6: Create hybrid search function using RRF (Reciprocal Rank Fusion)
-- =============================================================================

-- Hybrid search combining vector similarity and full-text search
-- Uses RRF to merge rankings: RRF(d) = Σ 1/(k + rank(d))
-- k=60 is a common constant that balances contribution from each ranking
CREATE OR REPLACE FUNCTION hybrid_match_thoughts(
    query_embedding vector(1536),
    query_text text,
    match_count int DEFAULT 10,
    filter_user_id text DEFAULT NULL,
    filter_tags text[] DEFAULT NULL,
    filter_kind text DEFAULT NULL,
    rrf_k int DEFAULT 60
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
    similarity float,
    text_rank float,
    hybrid_score float
)
LANGUAGE plpgsql
AS $$
DECLARE
    ts_query tsquery;
BEGIN
    -- Convert query text to tsquery (handles multi-word queries)
    ts_query := plainto_tsquery('english', query_text);
    
    RETURN QUERY
    WITH 
    -- Vector search results with ranking
    vector_results AS (
        SELECT
            t.id,
            1 - (t.embedding <=> query_embedding) as vec_similarity,
            ROW_NUMBER() OVER (ORDER BY t.embedding <=> query_embedding) as vec_rank
        FROM thoughts t
        WHERE t.embedding IS NOT NULL
            AND t.superseded_by_id IS NULL
            AND (filter_user_id IS NULL OR t.user_id = filter_user_id)
            AND (filter_tags IS NULL OR t.tags && filter_tags)
            AND (filter_kind IS NULL OR t.kind = filter_kind)
        ORDER BY t.embedding <=> query_embedding
        LIMIT match_count * 3  -- Get more candidates for fusion
    ),
    -- Full-text search results with ranking
    text_results AS (
        SELECT
            t.id,
            ts_rank_cd(t.search_vector, ts_query, 32) as txt_rank,  -- 32 = normalization by document length
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(t.search_vector, ts_query, 32) DESC) as txt_rank_pos
        FROM thoughts t
        WHERE t.search_vector @@ ts_query
            AND t.superseded_by_id IS NULL
            AND (filter_user_id IS NULL OR t.user_id = filter_user_id)
            AND (filter_tags IS NULL OR t.tags && filter_tags)
            AND (filter_kind IS NULL OR t.kind = filter_kind)
        ORDER BY ts_rank_cd(t.search_vector, ts_query, 32) DESC
        LIMIT match_count * 3
    ),
    -- Combine using Reciprocal Rank Fusion
    combined AS (
        SELECT
            COALESCE(v.id, t.id) as id,
            v.vec_similarity,
            t.txt_rank,
            -- RRF score: sum of reciprocal ranks from each method
            COALESCE(1.0 / (rrf_k + v.vec_rank), 0) + 
            COALESCE(1.0 / (rrf_k + t.txt_rank_pos), 0) as rrf_score
        FROM vector_results v
        FULL OUTER JOIN text_results t ON v.id = t.id
    )
    SELECT
        th.id,
        th.user_id,
        th.kind,
        th.domain,
        th.claim,
        th.stance,
        th.confidence,
        th.context,
        th.evidence,
        th.actionables,
        th.tags,
        th.created_at,
        COALESCE(c.vec_similarity, 0)::float as similarity,
        COALESCE(c.txt_rank, 0)::float as text_rank,
        c.rrf_score::float as hybrid_score
    FROM combined c
    JOIN thoughts th ON th.id = c.id
    ORDER BY c.rrf_score DESC
    LIMIT match_count;
END;
$$;

-- =============================================================================
-- STEP 7: Verify migration
-- =============================================================================

-- Run these queries to verify the migration worked:
-- SELECT COUNT(*) as thoughts_with_vector FROM thoughts WHERE search_vector IS NOT NULL;
-- SELECT id, claim, search_vector FROM thoughts LIMIT 5;
--
-- Test hybrid search (replace with actual embedding and query):
-- SELECT * FROM hybrid_match_thoughts(
--     '[0.1, 0.2, ...]'::vector(1536),  -- query embedding
--     'kubernetes debugging',            -- query text
--     5,                                  -- match count
--     'your-user-id'                     -- user filter
-- );

-- =============================================================================
-- NOTES
-- =============================================================================

-- RRF (Reciprocal Rank Fusion) explained:
-- - Each search method produces a ranked list
-- - RRF score = 1/(k + rank_vector) + 1/(k + rank_text)
-- - k=60 is the smoothing constant (higher k = more weight to lower-ranked results)
-- - Documents found by both methods get boosted
-- - Documents found by only one method still appear but with lower score
--
-- Weights in tsvector:
-- - 'A' (claim): highest weight, main searchable content
-- - 'B' (context): medium weight
-- - 'C' (tags, actionables, evidence): lower weight
--
-- ts_rank_cd uses cover density ranking which considers proximity of lexemes
