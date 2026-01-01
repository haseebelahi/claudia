-- Personal Knowledge Assistant - Database Schema
-- Run this in your Supabase SQL editor

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Conversations table
-- Tracks raw chat conversations before extraction
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_transcript TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'extracted', 'archived')),
    quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge entries extracted from conversations
-- Core knowledge storage with vector embeddings
CREATE TABLE knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('problem_solution', 'insight', 'decision', 'learning')),
    problem TEXT NOT NULL,
    context TEXT,
    solution TEXT NOT NULL,
    learnings TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    decay_weight FLOAT DEFAULT 1.0 CHECK (decay_weight >= 0 AND decay_weight <= 1)
);

-- Activity signals (post-MVP - passive layer)
-- Browser history, GitHub activity, bookmarks, etc.
CREATE TABLE activity_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL CHECK (source IN ('browser', 'github', 'twitter', 'linkedin', 'manual')),
    content TEXT NOT NULL,
    url TEXT,
    embedding vector(1536),
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

CREATE INDEX idx_knowledge_entries_conversation_id ON knowledge_entries(conversation_id);
CREATE INDEX idx_knowledge_entries_type ON knowledge_entries(type);
CREATE INDEX idx_knowledge_entries_created_at ON knowledge_entries(created_at DESC);
CREATE INDEX idx_knowledge_entries_tags ON knowledge_entries USING GIN(tags);

-- Vector similarity search index (IVFFlat for fast approximate search)
-- Adjust lists parameter based on row count: lists = rows / 1000 for < 1M rows
CREATE INDEX idx_knowledge_entries_embedding ON knowledge_entries 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_activity_signals_source ON activity_signals(source);
CREATE INDEX idx_activity_signals_captured_at ON activity_signals(captured_at DESC);
CREATE INDEX idx_activity_signals_embedding ON activity_signals 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Vector similarity search function
-- Returns knowledge entries similar to the query embedding
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
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
  ORDER BY knowledge_entries.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Vector similarity search for activity signals
CREATE OR REPLACE FUNCTION match_activity(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  source text,
  content text,
  url text,
  captured_at timestamp with time zone,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    activity_signals.id,
    activity_signals.source,
    activity_signals.content,
    activity_signals.url,
    activity_signals.captured_at,
    1 - (activity_signals.embedding <=> query_embedding) as similarity
  FROM activity_signals
  WHERE activity_signals.embedding IS NOT NULL
    AND 1 - (activity_signals.embedding <=> query_embedding) > match_threshold
  ORDER BY activity_signals.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Trigger to update updated_at timestamp on conversations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - Optional, enable if you want multi-user support later
-- For now, we'll skip RLS since this is a single-user system
-- Uncomment these if you want to add authentication later:

-- ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE activity_signals ENABLE ROW LEVEL SECURITY;

-- Sample query examples (commented out - for reference):

-- Insert a knowledge entry:
-- INSERT INTO knowledge_entries (type, problem, context, solution, learnings, tags)
-- VALUES (
--   'problem_solution',
--   'K8s pod getting OOMKilled despite high memory limits',
--   'Running Java app in Kubernetes with older JVM',
--   'Upgraded to JVM 17 which has container support by default',
--   ARRAY['Check JVM version first for memory issues', 'JVM 17+ has better container awareness'],
--   ARRAY['kubernetes', 'jvm', 'memory', 'debugging']
-- );

-- Search similar knowledge (after embedding is added):
-- SELECT * FROM match_knowledge(
--   '[your-embedding-vector]'::vector(1536),
--   0.7,
--   5
-- );
