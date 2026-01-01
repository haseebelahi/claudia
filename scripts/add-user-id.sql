-- Add user_id to conversations table to support multiple users
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_status ON conversations(user_id, status);
