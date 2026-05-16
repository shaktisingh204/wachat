/**
 * Forge block: Bitbucket
 *
 * n8n has no first-party Bitbucket node — only `BitbucketTrigger.node.ts`. This
 * port wraps the Bitbucket Cloud REST API directly using Basic auth (the
 * username + app-password pair that Bitbucket's `BitbucketApi` credential
 * defines).
 *
 * Credential type: 'bitbucket' (expects { username, appPassword }).
 *
 * Operations covered:
 *   - repository.get        GET  /repositories/{workspace}/{repo_slug}
 *   - pullrequest.create    POST /repositories/{workspace}/{repo_slug}/pullrequests
 *   - pullrequest.list      GET  /repositories/{workspace}/{repo_slug}/pullrequests
 *   - issue.create          POST /repositories/{workspace}/{repo_slug}/issues
 *
 * Deferred:
 *   - merge, comment, pipeline endpoints — re-add when needed.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const API = 'https://api.bitbucket.org/2.0';

function basicAuth(ctx: ForgeActionContext): string {
  const cred = requireCredential('Bitbucket', ctx.credential);
  const username = cred.username;
  const password = cred.appPassword;
  if (!username || !password) {
    throw new Error('Bitbucket: credential requires `username` and `appPassword`');
  }
  return `Basic ${btoa(`${username}:${password}`)}`;
}

async function repositoryGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workspace = asString(ctx.options.workspace);
  const repoSlug = asString(ctx.options.repoSlug);
  if (!workspace) throw new Error('Bitbucket: workspace is required');
  if (!repoSlug) throw new Error('Bitbucket: repoSlug is required');

  const res = await apiRequest({
    service: 'Bitbucket',
    method: 'GET',
    url: `${API}/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}`,
    headers: { Authorization: basicAuth(ctx) },
  });

  return {
    outputs: { repository: res.data },
    logs: [`Bitbucket repository get → ${workspace}/${repoSlug}`],
  };
}

async function pullRequestCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workspace = asString(ctx.options.workspace);
  const repoSlug = asString(ctx.options.repoSlug);
  const title = asString(ctx.options.title);
  const sourceBranch = asString(ctx.options.sourceBranch);
  const destinationBranch = asString(ctx.options.destinationBranch);
  if (!workspace) throw new Error('Bitbucket: workspace is required');
  if (!repoSlug) throw new Error('Bitbucket: repoSlug is required');
  if (!title) throw new Error('Bitbucket: title is required');
  if (!sourceBranch) throw new Error('Bitbucket: sourceBranch is required');

  const payload: Record<string, unknown> = {
    title,
    source: { branch: { name: sourceBranch } },
  };
  if (destinationBranch) {
    payload.destination = { branch: { name: destinationBranch } };
  }
  const description = asString(ctx.options.description);
  if (description) payload.description = description;

  const res = await apiRequest({
    service: 'Bitbucket',
    method: 'POST',
    url: `${API}/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}/pullrequests`,
    headers: { Authorization: basicAuth(ctx) },
    json: payload,
  });

  const pr = res.data as { id?: number };
  return {
    outputs: { pullRequest: res.data },
    logs: [`Bitbucket PR create → ${workspace}/${repoSlug}#${pr?.id ?? '?'}`],
  };
}

async function pullRequestList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workspace = asString(ctx.options.workspace);
  const repoSlug = asString(ctx.options.repoSlug);
  if (!workspace) throw new Error('Bitbucket: workspace is required');
  if (!repoSlug) throw new Error('Bitbucket: repoSlug is required');

  const params = new URLSearchParams();
  const state = asString(ctx.options.state);
  if (state) params.set('state', state);
  const qs = params.toString();

  const res = await apiRequest({
    service: 'Bitbucket',
    method: 'GET',
    url: `${API}/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}/pullrequests${qs ? `?${qs}` : ''}`,
    headers: { Authorization: basicAuth(ctx) },
  });

  const body = res.data as { values?: unknown[] };
  const values = Array.isArray(body?.values) ? body.values : [];
  return {
    outputs: { pullRequests: values, count: values.length },
    logs: [`Bitbucket PR list → ${workspace}/${repoSlug} (${values.length})`],
  };
}

async function issueCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workspace = asString(ctx.options.workspace);
  const repoSlug = asString(ctx.options.repoSlug);
  const title = asString(ctx.options.title);
  if (!workspace) throw new Error('Bitbucket: workspace is required');
  if (!repoSlug) throw new Error('Bitbucket: repoSlug is required');
  if (!title) throw new Error('Bitbucket: title is required');

  const payload: Record<string, unknown> = { title };
  const content = asString(ctx.options.content);
  if (content) payload.content = { raw: content };
  const kind = asString(ctx.options.kind);
  if (kind) payload.kind = kind;
  const priority = asString(ctx.options.priority);
  if (priority) payload.priority = priority;

  const res = await apiRequest({
    service: 'Bitbucket',
    method: 'POST',
    url: `${API}/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}/issues`,
    headers: { Authorization: basicAuth(ctx) },
    json: payload,
  });

  const issue = res.data as { id?: number };
  return {
    outputs: { issue: res.data },
    logs: [`Bitbucket issue create → ${workspace}/${repoSlug}#${issue?.id ?? '?'}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_bitbucket',
  name: 'Bitbucket',
  description: 'Read repos, manage pull requests and issues on Bitbucket Cloud.',
  iconName: 'LuGitMerge',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'bitbucket' },
  actions: [
    {
      id: 'repository_get',
      label: 'Get repository',
      description: 'Fetch metadata for a Bitbucket repo.',
      fields: [
        { id: 'workspace', label: 'Workspace', type: 'text', required: true, placeholder: 'my-team' },
        { id: 'repoSlug', label: 'Repository slug', type: 'text', required: true, placeholder: 'my-repo' },
      ],
      run: repositoryGet,
    },
    {
      id: 'pullrequest_create',
      label: 'Create pull request',
      description: 'Open a new PR between branches.',
      fields: [
        { id: 'workspace', label: 'Workspace', type: 'text', required: true },
        { id: 'repoSlug', label: 'Repository slug', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'sourceBranch', label: 'Source branch', type: 'text', required: true },
        { id: 'destinationBranch', label: 'Destination branch', type: 'text', placeholder: 'main' },
        { id: 'description', label: 'Description', type: 'textarea' },
      ],
      run: pullRequestCreate,
    },
    {
      id: 'pullrequest_list',
      label: 'List pull requests',
      description: 'List pull requests in a repo.',
      fields: [
        { id: 'workspace', label: 'Workspace', type: 'text', required: true },
        { id: 'repoSlug', label: 'Repository slug', type: 'text', required: true },
        {
          id: 'state',
          label: 'State',
          type: 'select',
          options: [
            { label: 'Open', value: 'OPEN' },
            { label: 'Merged', value: 'MERGED' },
            { label: 'Declined', value: 'DECLINED' },
            { label: 'All', value: '' },
          ],
        },
      ],
      run: pullRequestList,
    },
    {
      id: 'issue_create',
      label: 'Create issue',
      description: 'Open a new issue in a Bitbucket repo (issue tracker must be enabled).',
      fields: [
        { id: 'workspace', label: 'Workspace', type: 'text', required: true },
        { id: 'repoSlug', label: 'Repository slug', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'content', label: 'Content', type: 'textarea' },
        {
          id: 'kind',
          label: 'Kind',
          type: 'select',
          options: [
            { label: 'Bug', value: 'bug' },
            { label: 'Enhancement', value: 'enhancement' },
            { label: 'Proposal', value: 'proposal' },
            { label: 'Task', value: 'task' },
          ],
        },
        {
          id: 'priority',
          label: 'Priority',
          type: 'select',
          options: [
            { label: 'Trivial', value: 'trivial' },
            { label: 'Minor', value: 'minor' },
            { label: 'Major', value: 'major' },
            { label: 'Critical', value: 'critical' },
            { label: 'Blocker', value: 'blocker' },
          ],
        },
      ],
      run: issueCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
