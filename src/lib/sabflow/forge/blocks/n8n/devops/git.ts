/**
 * Forge block: Git
 *
 * Source: n8n-master/packages/nodes-base/nodes/Git/Git.node.ts (the upstream
 * node shells out to `git` via simple-git).
 *
 * ⚠️ Shell-git is out of scope. SabFlow runs blocks server-side without an
 * exclusive workspace dir, so cloning/committing locally would leak state
 * across tenants. Instead this block is a REST-driven helper: it parses the
 * configured `repositoryUrl` and routes platform-specific calls to the
 * underlying provider (GitHub or GitLab today).
 *
 * Credential type: 'git' (expects { repositoryUrl?, username?, password? }).
 * `password` is treated as the personal access token used as Bearer (GitHub)
 * or PRIVATE-TOKEN (GitLab).
 *
 * Operations covered:
 *   - parse_url            Pure JS — split repoUrl into host/owner/repo
 *   - list_commits_github  GET https://api.github.com/repos/{o}/{r}/commits
 *   - list_commits_gitlab  GET https://gitlab.com/api/v4/projects/{enc}/repository/commits
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

type ParsedRepo = {
  host: string;
  owner: string;
  repo: string;
  url: string;
};

function parseRepoUrl(input: string): ParsedRepo {
  if (!input) throw new Error('Git: repository URL is required');
  // Normalise: strip trailing .git and any auth pair in the URL.
  let trimmed = input.trim();
  if (trimmed.endsWith('.git')) trimmed = trimmed.slice(0, -4);
  // git@github.com:owner/repo  →  https://github.com/owner/repo
  const sshMatch = trimmed.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    trimmed = `https://${sshMatch[1]}/${sshMatch[2]}`;
  }
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new Error(`Git: cannot parse repository URL "${input}"`);
  }
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Git: repository URL "${input}" is missing owner/repo`);
  }
  // GitLab supports nested groups → join all but last as owner namespace.
  const repo = parts[parts.length - 1];
  const owner = parts.slice(0, -1).join('/');
  return { host: u.host, owner, repo, url: `${u.protocol}//${u.host}/${parts.join('/')}` };
}

function resolveRepoUrl(ctx: ForgeActionContext): string {
  const fromOption = asString(ctx.options.repositoryUrl);
  if (fromOption) return fromOption;
  const cred = ctx.credential ?? {};
  return cred.repositoryUrl ?? '';
}

async function parseUrl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = resolveRepoUrl(ctx);
  const parsed = parseRepoUrl(url);
  return {
    outputs: { ...parsed },
    logs: [`Git parse → ${parsed.host}/${parsed.owner}/${parsed.repo}`],
  };
}

async function listCommitsGithub(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = requireCredential('Git', ctx.credential);
  const url = resolveRepoUrl(ctx);
  const { owner, repo } = parseRepoUrl(url);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (cred.password) headers.Authorization = `Bearer ${cred.password}`;

  const params = new URLSearchParams();
  const branch = asString(ctx.options.branch);
  const perPage = asString(ctx.options.perPage);
  if (branch) params.set('sha', branch);
  if (perPage) params.set('per_page', perPage);
  const qs = params.toString();

  const res = await apiRequest({
    service: 'Git (GitHub)',
    method: 'GET',
    url: `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits${qs ? `?${qs}` : ''}`,
    headers,
  });
  const commits = Array.isArray(res.data) ? res.data : [];
  return {
    outputs: { commits, count: commits.length },
    logs: [`Git list commits (GitHub) → ${owner}/${repo} (${commits.length})`],
  };
}

async function listCommitsGitlab(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = requireCredential('Git', ctx.credential);
  const url = resolveRepoUrl(ctx);
  const parsed = parseRepoUrl(url);
  const fullPath = `${parsed.owner}/${parsed.repo}`;
  const host = parsed.host || 'gitlab.com';

  const headers: Record<string, string> = {};
  if (cred.password) headers['PRIVATE-TOKEN'] = cred.password;

  const params = new URLSearchParams();
  const branch = asString(ctx.options.branch);
  const perPage = asString(ctx.options.perPage);
  if (branch) params.set('ref_name', branch);
  if (perPage) params.set('per_page', perPage);
  const qs = params.toString();

  const res = await apiRequest({
    service: 'Git (GitLab)',
    method: 'GET',
    url: `https://${host}/api/v4/projects/${encodeURIComponent(fullPath)}/repository/commits${qs ? `?${qs}` : ''}`,
    headers,
  });
  const commits = Array.isArray(res.data) ? res.data : [];
  return {
    outputs: { commits, count: commits.length },
    logs: [`Git list commits (GitLab) → ${fullPath} (${commits.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_git',
  name: 'Git',
  description: 'Parse a repo URL and read commits via GitHub/GitLab REST. Shell git is out of scope.',
  iconName: 'LuGitBranch',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'git' },
  actions: [
    {
      id: 'parse_url',
      label: 'Parse repo URL',
      description: 'Split a repo URL into host / owner / repo.',
      fields: [
        {
          id: 'repositoryUrl',
          label: 'Repository URL (overrides credential)',
          type: 'text',
          placeholder: 'https://github.com/owner/repo.git',
        },
      ],
      run: parseUrl,
    },
    {
      id: 'list_commits_github',
      label: 'List commits (GitHub)',
      description: 'List commits via the GitHub REST API.',
      fields: [
        { id: 'repositoryUrl', label: 'Repository URL', type: 'text' },
        { id: 'branch', label: 'Branch / SHA', type: 'text', placeholder: 'main' },
        { id: 'perPage', label: 'Per page', type: 'number', placeholder: '30' },
      ],
      run: listCommitsGithub,
    },
    {
      id: 'list_commits_gitlab',
      label: 'List commits (GitLab)',
      description: 'List commits via the GitLab v4 API.',
      fields: [
        { id: 'repositoryUrl', label: 'Repository URL', type: 'text' },
        { id: 'branch', label: 'Branch / ref', type: 'text', placeholder: 'main' },
        { id: 'perPage', label: 'Per page', type: 'number', placeholder: '20' },
      ],
      run: listCommitsGitlab,
    },
  ],
};

registerForgeBlock(block);
export default block;
