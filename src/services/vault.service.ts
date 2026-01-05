import { config } from '../config';
import { Thought, Source } from '../models/knowledge-entry';

interface VaultConfig {
  enabled: boolean;
  owner: string;
  repo: string;
  token: string;
}

class VaultService {
  private config: VaultConfig;
  private baseUrl = 'https://api.github.com';

  constructor() {
    const [owner, repo] = config.vault.githubRepo.split('/');
    
    this.config = {
      enabled: config.vault.enabled,
      owner: owner || '',
      repo: repo || '',
      token: config.vault.githubToken,
    };

    if (this.config.enabled) {
      console.log(`Vault service enabled: ${this.config.owner}/${this.config.repo}`);
    } else {
      console.log('Vault service disabled (missing GITHUB_VAULT_TOKEN or GITHUB_VAULT_REPO)');
    }
  }

  /**
   * Make an authenticated request to GitHub API
   */
  private async githubRequest(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<{ status: number; data: unknown }> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `token ${this.config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'personal-assistant-vault',
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

  /**
   * Write a thought to the vault as a Markdown file
   */
  async writeThought(thought: Thought, sourceIds?: string[]): Promise<string | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const path = this.getThoughtPath(thought);
      const content = this.formatThoughtMarkdown(thought, sourceIds);
      const message = `Add thought: ${this.generateSlug(thought.claim, 50)}`;

      await this.commitFile(path, content, message);
      console.log(`Vault: wrote thought to ${path}`);
      return path;
    } catch (error) {
      console.error('Vault: failed to write thought:', error);
      return null;
    }
  }

  /**
   * Write a source to the vault as a Markdown file
   */
  async writeSource(source: Source, thoughtIds?: string[]): Promise<string | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const path = this.getSourcePath(source);
      const content = this.formatSourceMarkdown(source, thoughtIds);
      const message = `Add source: ${source.title || this.generateSlug(source.raw.slice(0, 100), 50)}`;

      await this.commitFile(path, content, message);
      console.log(`Vault: wrote source to ${path}`);
      return path;
    } catch (error) {
      console.error('Vault: failed to write source:', error);
      return null;
    }
  }

  /**
   * Format a thought as Obsidian-compatible Markdown with YAML frontmatter
   */
  private formatThoughtMarkdown(thought: Thought, sourceIds?: string[]): string {
    const date = thought.createdAt instanceof Date 
      ? thought.createdAt 
      : new Date(thought.createdAt);
    
    const frontmatter: Record<string, unknown> = {
      id: thought.id,
      kind: thought.kind,
      domain: thought.domain,
      privacy: thought.privacy,
      stance: thought.stance,
      confidence: thought.confidence,
      tags: thought.tags,
      created_at: date.toISOString(),
    };

    if (sourceIds && sourceIds.length > 0) {
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
    markdown += this.formatYaml(frontmatter);
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

  /**
   * Format a source as Obsidian-compatible Markdown with YAML frontmatter
   */
  private formatSourceMarkdown(source: Source, thoughtIds?: string[]): string {
    const capturedAt = source.capturedAt instanceof Date 
      ? source.capturedAt 
      : new Date(source.capturedAt);

    const frontmatter: Record<string, unknown> = {
      id: source.id,
      type: source.type,
      title: source.title || null,
      captured_at: capturedAt.toISOString(),
      url: source.url || null,
    };

    let markdown = '---\n';
    markdown += this.formatYaml(frontmatter);
    markdown += '---\n\n';

    if (thoughtIds && thoughtIds.length > 0) {
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

  /**
   * Format an object as YAML (simple implementation)
   */
  private formatYaml(obj: Record<string, unknown>): string {
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
        // Quote strings that contain special YAML characters
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

  /**
   * Generate a URL-safe slug from text
   */
  private generateSlug(text: string, maxLength = 50): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
      .replace(/\s+/g, '-')           // Replace spaces with hyphens
      .replace(/-+/g, '-')            // Remove consecutive hyphens
      .slice(0, maxLength)
      .replace(/-$/, '');             // Remove trailing hyphen
  }

  /**
   * Get the vault path for a thought
   * Format: thoughts/YYYY/MM/<id>-<slug>.md
   */
  private getThoughtPath(thought: Thought): string {
    const date = thought.createdAt instanceof Date 
      ? thought.createdAt 
      : new Date(thought.createdAt);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const slug = this.generateSlug(thought.claim, 40);
    const shortId = thought.id.split('-')[0];  // First segment of UUID

    return `thoughts/${year}/${month}/${shortId}-${slug}.md`;
  }

  /**
   * Get the vault path for a source
   * Format: sources/YYYY/MM/<id>-<slug>.md
   */
  private getSourcePath(source: Source): string {
    const date = source.capturedAt instanceof Date 
      ? source.capturedAt 
      : new Date(source.capturedAt);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const titleOrRaw = source.title || source.raw.slice(0, 100);
    const slug = this.generateSlug(titleOrRaw, 40);
    const shortId = source.id.split('-')[0];  // First segment of UUID

    return `sources/${year}/${month}/${shortId}-${slug}.md`;
  }

  /**
   * Commit a file to the GitHub repository
   */
  private async commitFile(path: string, content: string, message: string): Promise<void> {
    const { owner, repo } = this.config;
    const endpoint = `/repos/${owner}/${repo}/contents/${path}`;

    // Check if file already exists (to get the SHA for updates)
    let sha: string | undefined;
    const getResult = await this.githubRequest('GET', endpoint);
    
    if (getResult.status === 200) {
      const data = getResult.data as { sha?: string; type?: string };
      if (data.type === 'file' && data.sha) {
        sha = data.sha;
      }
    } else if (getResult.status !== 404) {
      throw new Error(`GitHub API error: ${getResult.status} - ${JSON.stringify(getResult.data)}`);
    }

    // Create or update the file
    const body: Record<string, unknown> = {
      message,
      content: Buffer.from(content).toString('base64'),
    };

    if (sha) {
      body.sha = sha;  // Required for updates
    }

    const putResult = await this.githubRequest('PUT', endpoint, body);

    if (putResult.status !== 200 && putResult.status !== 201) {
      throw new Error(`GitHub API error: ${putResult.status} - ${JSON.stringify(putResult.data)}`);
    }
  }
}

// Export singleton instance
export const vaultService = new VaultService();
