-- Phase 2A Migration: Add user_id to knowledge_entries and update match_knowledge function
-- Run this in your Supabase SQL editor

-- Step 1: Add user_id column to knowledge_entries for direct user association
-- This allows /remember entries to exist without a conversation
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Step 2: Create index for faster user-based lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_user_id ON knowledge_entries(user_id);

-- Step 3: Update the type constraint to include new entry types for /remember
-- First, drop the existing constraint
ALTER TABLE knowledge_entries DROP CONSTRAINT IF EXISTS knowledge_entries_type_check;

-- Add new constraint with expanded types
ALTER TABLE knowledge_entries ADD CONSTRAINT knowledge_entries_type_check 
CHECK (type IN (
  'problem_solution', 'insight', 'decision', 'learning',  -- existing types (from conversations)
  'fact', 'preference', 'event', 'relationship', 'goal',   -- new types (from /remember)
  'article_summary', 'research'                            -- future types (from /read, /research)
));

-- Step 4: Backfill user_id from conversations for existing entries
UPDATE knowledge_entries ke
SET user_id = c.user_id
FROM conversations c
WHERE ke.conversation_id = c.id
  AND ke.user_id IS NULL;

-- Step 5: Update match_knowledge function to support user filtering
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_user_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  user_id text,
  type text,
  problem text,
  context text,
  solution text,
  learnings text[],
  tags text[],
  created_at timestamp with time zone,
  decay_weight float,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_entries.id,
    knowledge_entries.conversation_id,
    knowledge_entries.user_id,
    knowledge_entries.type,
    knowledge_entries.problem,
    knowledge_entries.context,
    knowledge_entries.solution,
    knowledge_entries.learnings,
    knowledge_entries.tags,
    knowledge_entries.created_at,
    knowledge_entries.decay_weight,
    1 - (knowledge_entries.embedding <=> query_embedding) as similarity
  FROM knowledge_entries
  WHERE knowledge_entries.embedding IS NOT NULL
    AND 1 - (knowledge_entries.embedding <=> query_embedding) > match_threshold
    AND (filter_user_id IS NULL OR knowledge_entries.user_id = filter_user_id)
  ORDER BY knowledge_entries.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Verify the migration
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'knowledge_entries' AND column_name = 'user_id';
