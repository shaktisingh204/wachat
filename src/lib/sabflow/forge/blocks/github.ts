/**
 * Forge block: GitHub.
 *
 * Auth: routed through SabFlow Connections (credentialType `github`).
 *   credential.accessToken → personal access token used in the Bearer header.
 * Actions: Create issue, Add comment.
 */

import { registerForgeBlock } from '../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../types';

const GITHUB_API = 'https://api.github.com';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

const ensureCred = (ctx: ForgeActionContext) => {
  if (!ctx.credential?.accessToken) {
    throw new Error('GitHub: select a credential from SabFlow Connections');
  }
};

const ghHeaders = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

const parseLabels = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

async function createIssue(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const owner = str(ctx.options.owner);
  const repo = str(ctx.options.repo);
  const title = str(ctx.options.title);
  const body = str(ctx.options.body);
  const labels = parseLabels(ctx.options.labels);
  const outputVariable = str(ctx.options.outputVariable);

  ensureCred(ctx);
  const r = await ctx.helpers!.requestWithAuthentication('bearer', {
    method: 'POST',
    url: `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
    headers: ghHeaders,
    json: { title, body, labels },
  });
  if (!r.ok) throw new Error(`GitHub create issue failed: ${r.status}`);

  const outputs: Record<string, unknown> = {};
  if (outputVariable) outputs[outputVariable] = r.data;
  return { outputs, logs: [`GitHub: issue created in ${owner}/${repo}`] };
}

async function addComment(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const owner = str(ctx.options.owner);
  const repo = str(ctx.options.repo);
  const issueNumber = str(ctx.options.issueNumber);
  const body = str(ctx.options.body);

  ensureCred(ctx);
  const r = await ctx.helpers!.requestWithAuthentication('bearer', {
    method: 'POST',
    url: `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(issueNumber)}/comments`,
    headers: ghHeaders,
    json: { body },
  });
  if (!r.ok) throw new Error(`GitHub add comment failed: ${r.status}`);

  return { logs: [`GitHub: commented on ${owner}/${repo}#${issueNumber}`] };
}

const block: ForgeBlock = {
  id: 'forge_github',
  name: 'GitHub',
  description: 'Create issues and comments on a GitHub repository.',
  iconName: 'LuGithub',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'github',
  },
  actions: [
    {
      id: 'create_issue',
      label: 'Create Issue',
      description: 'Open a new issue in a repository.',
      fields: [
        { id: 'owner', label: 'Owner', type: 'text', placeholder: 'octocat', required: true },
        { id: 'repo', label: 'Repository', type: 'text', placeholder: 'hello-world', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'body', label: 'Body', type: 'textarea' },
        {
          id: 'labels',
          label: 'Labels',
          type: 'text',
          placeholder: 'bug, triage',
          helperText: 'Comma-separated list of labels.',
        },
        { id: 'outputVariable', label: 'Save issue to variable', type: 'variable' },
      ],
      run: createIssue,
    },
    {
      id: 'add_comment',
      label: 'Add Comment',
      description: 'Post a comment on an existing issue or PR.',
      fields: [
        { id: 'owner', label: 'Owner', type: 'text', required: true },
        { id: 'repo', label: 'Repository', type: 'text', required: true },
        { id: 'issueNumber', label: 'Issue / PR Number', type: 'number', required: true },
        { id: 'body', label: 'Comment', type: 'textarea', required: true },
      ],
      run: addComment,
    },
  ],
};

registerForgeBlock(block);

export default block;
