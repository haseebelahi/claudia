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
  vault: {
    enabled: boolean;
    githubToken: string;
    githubRepo: string;  // format: "owner/repo"
  };
  app: {
    nodeEnv: string;
    port: number;
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

function getOptionalEnvVar(key: string): string {
  return process.env[key] || '';
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
  vault: {
    enabled: !!process.env.GITHUB_VAULT_TOKEN && !!process.env.GITHUB_VAULT_REPO,
    githubToken: getOptionalEnvVar('GITHUB_VAULT_TOKEN'),
    githubRepo: getOptionalEnvVar('GITHUB_VAULT_REPO'),
  },
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    maxConversationLength: parseInt(process.env.MAX_CONVERSATION_LENGTH || '200', 10),
  },
};
