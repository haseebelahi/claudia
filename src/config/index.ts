import dotenv from 'dotenv';

dotenv.config();

interface Config {
  telegram: {
    botToken: string;
  };
  llm: {
    apiKey: string;
    model: string;
    baseUrl: string;
  };
  openai: {
    apiKey: string;
  };
  supabase: {
    url: string;
    key: string;
  };
  app: {
    nodeEnv: string;
    port: number;
    conversationTimeoutMs: number;
    maxConversationLength: number;
  };
}

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config: Config = {
  telegram: {
    botToken: getEnvVar('TELEGRAM_BOT_TOKEN'),
  },
  llm: {
    apiKey: getEnvVar('OPENROUTER_API_KEY'),
    model: process.env.LLM_MODEL || 'anthropic/claude-3.5-sonnet',
    baseUrl: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
  },
  openai: {
    apiKey: getEnvVar('OPENAI_API_KEY'),
  },
  supabase: {
    url: getEnvVar('SUPABASE_URL'),
    key: getEnvVar('SUPABASE_KEY'),
  },
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    conversationTimeoutMs: parseInt(process.env.CONVERSATION_TIMEOUT_MS || '300000', 10),
    maxConversationLength: parseInt(process.env.MAX_CONVERSATION_LENGTH || '50', 10),
  },
};
