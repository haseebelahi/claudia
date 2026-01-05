#!/usr/bin/env npx ts-node

/**
 * Migration script: Export existing sources and thoughts to Markdown vault
 * 
 * Usage:
 *   npx ts-node scripts/migrate-to-vault.ts
 * 
 * Prerequisites:
 *   - GITHUB_VAULT_TOKEN and GITHUB_VAULT_REPO env vars set
 *   - The vault repo must exist on GitHub
 *   - Supabase credentials in .env
 */

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

// Types (copied from models to keep script standalone)
interface Thought {
  id: string;
  user_id: string;
  kind: string;
  domain: string;
  claim: string;
  stance: string;
  confidence: number;
  privacy: string;
  context?: string;
  evidence?: string[];
  examples?: string[];
  actionables?: string[];
  tags: string[];
  supersedes_id?: string;
  superseded_by_id?: string;
  related_ids?: string[];
  created_at: string;
  updated_at: string;
}

interface Source {
  id: string;
  user_id: string;
  type: string;
  title?: string;
  raw: string;
  summary?: string;
  url?: string;
  captured_at: string;
  created_at: string;
  updated_at: string;
}

interface ThoughtSource {
  thought_id: string;
  source_id: string;
}

// Configuration
const scriptConfig = {
  supabase: {
    url: process.env.SUPABASE_URL!,
    key: process.env.SUPABASE_KEY!,
  },
  vault: {
    token: process.env.GITHUB_VAULT_TOKEN!,
    repo: process.env.GITHUB_VAULT_REPO!,
  },
};

// Validate config
function validateConfig(): boolean {
  const missing: string[] = [];
  if (!scriptConfig.supabase.url) missing.push('SUPABASE_URL');
  if (!scriptConfig.supabase.key) missing.push('SUPABASE_KEY');
  if (!scriptConfig.vault.token) missing.push('GITHUB_VAULT_TOKEN');
  if (!scriptConfig.vault.repo) missing.push('GITHUB_VAULT_REPO');

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    return false;
  }
  return true;
}

// Initialize Supabase client
const supabase = createClient(scriptConfig.supabase.url, scriptConfig.supabase.key);

// GitHub API helper using fetch
const GITHUB_API_BASE = 'https://api.github.com';

async function githubRequest(
  method: string,
  endpoint: string,
  body?: Record<string, unknown>
): Promise<{ status: number; data: unknown }> {
  const url = `${GITHUB_API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    'Authorization': `token ${scriptConfig.vault.token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'personal-assistant-vault-migration',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

// Formatting functions
function generateSlug(text: string, maxLength = 50): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, maxLength)
    .replace(/-$/, '');
}

function formatYaml(obj: Record<string, unknown>): string {
  let yaml = '';
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yaml += `${key}: null\n`;
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        yaml += `${key}: []\n`;
      } else {
        yaml += `${key}:\n`;
        for (const item of value) {
          yaml += `  - ${typeof item === 'string' ? `"${item.replace(/"/g, '\\"')}"` : item}\n`;
        }
      }
    } else if (typeof value === 'string') {
      if (value.includes(':') || value.includes('#') || value.includes('\n')) {
        yaml += `${key}: "${value.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"\n`;
      } else {
        yaml += `${key}: ${value}\n`;
      }
    } else {
      yaml += `${key}: ${value}\n`;
    }
  }
  return yaml;
}

function getThoughtPath(thought: Thought): string {
  const date = new Date(thought.created_at);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const slug = generateSlug(thought.claim, 40);
  const shortId = thought.id.split('-')[0];
  return `thoughts/${year}/${month}/${shortId}-${slug}.md`;
}

function getSourcePath(source: Source): string {
  const date = new Date(source.captured_at);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const titleOrRaw = source.title || source.raw.slice(0, 100);
  const slug = generateSlug(titleOrRaw, 40);
  const shortId = source.id.split('-')[0];
  return `sources/${year}/${month}/${shortId}-${slug}.md`;
}

function formatThoughtMarkdown(thought: Thought, sourceIds: string[]): string {
  const frontmatter: Record<string, unknown> = {
    id: thought.id,
    kind: thought.kind,
    domain: thought.domain,
    privacy: thought.privacy,
    stance: thought.stance,
    confidence: thought.confidence,
    tags: thought.tags || [],
    created_at: thought.created_at,
  };

  if (sourceIds.length > 0) {
    frontmatter.sources = sourceIds.map(id => `[[sources/${id}]]`);
  }

  if (thought.supersedes_id) {
    frontmatter.supersedes = `[[thoughts/${thought.supersedes_id}]]`;
  }

  if (thought.superseded_by_id) {
    frontmatter.superseded_by = `[[thoughts/${thought.superseded_by_id}]]`;
  }

  if (thought.related_ids && thought.related_ids.length > 0) {
    frontmatter.related = thought.related_ids.map(id => `[[thoughts/${id}]]`);
  }

  let markdown = '---\n';
  markdown += formatYaml(frontmatter);
  markdown += '---\n\n';

  markdown += `## Claim\n${thought.claim}\n\n`;

  if (thought.context) {
    markdown += `## Context\n${thought.context}\n\n`;
  }

  if (thought.evidence && thought.evidence.length > 0) {
    markdown += `## Evidence\n`;
    for (const item of thought.evidence) {
      markdown += `- ${item}\n`;
    }
    markdown += '\n';
  }

  if (thought.examples && thought.examples.length > 0) {
    markdown += `## Examples\n`;
    for (const item of thought.examples) {
      markdown += `- ${item}\n`;
    }
    markdown += '\n';
  }

  if (thought.actionables && thought.actionables.length > 0) {
    markdown += `## Actionables\n`;
    for (const item of thought.actionables) {
      markdown += `- ${item}\n`;
    }
    markdown += '\n';
  }

  return markdown;
}

function formatSourceMarkdown(source: Source, thoughtIds: string[]): string {
  const frontmatter: Record<string, unknown> = {
    id: source.id,
    type: source.type,
    title: source.title || null,
    captured_at: source.captured_at,
    url: source.url || null,
  };

  let markdown = '---\n';
  markdown += formatYaml(frontmatter);
  markdown += '---\n\n';

  if (thoughtIds.length > 0) {
    markdown += `## Extracted Thoughts\n`;
    for (const id of thoughtIds) {
      markdown += `- [[thoughts/${id}]]\n`;
    }
    markdown += '\n';
  }

  if (source.summary) {
    markdown += `## Summary\n${source.summary}\n\n`;
  }

  markdown += `## Raw\n${source.raw}\n`;

  return markdown;
}

async function commitFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string
): Promise<boolean> {
  try {
    const endpoint = `/repos/${owner}/${repo}/contents/${path}`;
    
    // Check if file already exists
    let sha: string | undefined;
    const getResult = await githubRequest('GET', endpoint);
    
    if (getResult.status === 200) {
      const data = getResult.data as { sha?: string; type?: string };
      if (data.type === 'file' && data.sha) {
        sha = data.sha;
        console.log(`  File exists, will update: ${path}`);
      }
    } else if (getResult.status !== 404) {
      console.error(`  Unexpected status checking file: ${getResult.status}`);
      return false;
    }

    // Create or update the file
    const body: Record<string, unknown> = {
      message,
      content: Buffer.from(content).toString('base64'),
    };

    if (sha) {
      body.sha = sha;
    }

    const putResult = await githubRequest('PUT', endpoint, body);

    if (putResult.status !== 200 && putResult.status !== 201) {
      console.error(`  Failed to commit: ${putResult.status} - ${JSON.stringify(putResult.data)}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`  Failed to commit ${path}:`, error);
    return false;
  }
}

async function main() {
  console.log('=== Vault Migration Script ===\n');

  if (!validateConfig()) {
    process.exit(1);
  }

  const [owner, repo] = scriptConfig.vault.repo.split('/');
  console.log(`Target vault: ${owner}/${repo}\n`);

  // Verify repo access
  const repoCheck = await githubRequest('GET', `/repos/${owner}/${repo}`);
  if (repoCheck.status !== 200) {
    console.error('Cannot access vault repository. Does it exist?');
    console.error(`Status: ${repoCheck.status}, Response: ${JSON.stringify(repoCheck.data)}`);
    console.error('Create it at: https://github.com/new');
    process.exit(1);
  }
  console.log('Vault repository access verified.\n');

  // Fetch all data
  console.log('Fetching data from Supabase...');

  const { data: thoughts, error: thoughtsError } = await supabase
    .from('thoughts')
    .select('*')
    .order('created_at', { ascending: true });

  if (thoughtsError) {
    console.error('Failed to fetch thoughts:', thoughtsError);
    process.exit(1);
  }

  const { data: sources, error: sourcesError } = await supabase
    .from('sources')
    .select('*')
    .order('created_at', { ascending: true });

  if (sourcesError) {
    console.error('Failed to fetch sources:', sourcesError);
    process.exit(1);
  }

  const { data: thoughtSources, error: tsError } = await supabase
    .from('thought_sources')
    .select('*');

  if (tsError) {
    console.error('Failed to fetch thought_sources:', tsError);
    process.exit(1);
  }

  console.log(`Found: ${thoughts?.length || 0} thoughts, ${sources?.length || 0} sources, ${thoughtSources?.length || 0} links\n`);

  // Build lookup maps
  const thoughtToSources = new Map<string, string[]>();
  const sourceToThoughts = new Map<string, string[]>();

  for (const ts of (thoughtSources || []) as ThoughtSource[]) {
    if (!thoughtToSources.has(ts.thought_id)) {
      thoughtToSources.set(ts.thought_id, []);
    }
    thoughtToSources.get(ts.thought_id)!.push(ts.source_id);

    if (!sourceToThoughts.has(ts.source_id)) {
      sourceToThoughts.set(ts.source_id, []);
    }
    sourceToThoughts.get(ts.source_id)!.push(ts.thought_id);
  }

  // Migrate sources first (so thoughts can reference them)
  console.log('--- Migrating Sources ---');
  let sourcesSuccess = 0;
  let sourcesFailed = 0;

  for (const source of (sources || []) as Source[]) {
    const path = getSourcePath(source);
    const thoughtIds = sourceToThoughts.get(source.id) || [];
    const content = formatSourceMarkdown(source, thoughtIds);
    const message = `Add source: ${source.title || source.id.split('-')[0]}`;

    console.log(`Writing: ${path}`);
    const success = await commitFile(owner, repo, path, content, message);
    if (success) {
      sourcesSuccess++;
    } else {
      sourcesFailed++;
    }

    // Rate limiting - GitHub API has limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\nSources: ${sourcesSuccess} written, ${sourcesFailed} failed\n`);

  // Migrate thoughts
  console.log('--- Migrating Thoughts ---');
  let thoughtsSuccess = 0;
  let thoughtsFailed = 0;

  for (const thought of (thoughts || []) as Thought[]) {
    const path = getThoughtPath(thought);
    const sourceIds = thoughtToSources.get(thought.id) || [];
    const content = formatThoughtMarkdown(thought, sourceIds);
    const message = `Add thought: ${generateSlug(thought.claim, 50)}`;

    console.log(`Writing: ${path}`);
    const success = await commitFile(owner, repo, path, content, message);
    if (success) {
      thoughtsSuccess++;
    } else {
      thoughtsFailed++;
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\nThoughts: ${thoughtsSuccess} written, ${thoughtsFailed} failed\n`);

  // Summary
  console.log('=== Migration Complete ===');
  console.log(`Sources:  ${sourcesSuccess}/${(sources || []).length} migrated`);
  console.log(`Thoughts: ${thoughtsSuccess}/${(thoughts || []).length} migrated`);
  console.log(`\nView your vault at: https://github.com/${owner}/${repo}`);
}

main().catch(console.error);
