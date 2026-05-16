/**
 * Forge block: GitHub Document Loader
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/document_loaders/DocumentGithubLoader
 *
 * Pulls a file from a GitHub repo via the contents API and returns its decoded
 * text as a single document. Token is optional — required only for private
 * repos or to lift rate limits.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

async function load(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const owner = asString(ctx.options.owner);
  if (!owner) throw new Error('GithubLoader: owner is required');
  const repo = asString(ctx.options.repo);
  if (!repo) throw new Error('GithubLoader: repo is required');
  const path = asString(ctx.options.path);
  if (!path) throw new Error('GithubLoader: path is required');
  const ref = asString(ctx.options.ref);
  const token = asString(ctx.options.token);

  const cleanPath = path.replace(/^\//, '');
  const qs = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${cleanPath}${qs}`;

  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await apiRequest({ service: 'GitHub', method: 'GET', url, headers });
  const body = res.data as
    | {
        name?: string;
        path?: string;
        sha?: string;
        size?: number;
        content?: string;
        encoding?: string;
        type?: string;
      }
    | unknown[];

  if (Array.isArray(body)) {
    throw new Error('GithubLoader: path resolved to a directory — point at a specific file');
  }
  const file = body;
  if (!file?.content) throw new Error('GithubLoader: response contained no content');
  const decoded =
    file.encoding === 'base64'
      ? Buffer.from(file.content, 'base64').toString('utf-8')
      : asString(file.content);

  const docs = [
    {
      pageContent: decoded,
      metadata: {
        source: `github://${owner}/${repo}/${cleanPath}${ref ? `@${ref}` : ''}`,
        name: file.name,
        path: file.path,
        sha: file.sha,
        size: file.size,
      },
    },
  ];

  return {
    outputs: { documents: docs, count: docs.length },
    logs: [`GithubLoader → ${owner}/${repo}/${cleanPath} (${decoded.length} chars)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_doc_loader_github',
  name: 'GitHub Document Loader',
  description: 'Fetch a file from a GitHub repo as a document.',
  iconName: 'LuGithub',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'load',
      label: 'Load file',
      description: 'Fetch a file from GitHub via the contents API.',
      fields: [
        { id: 'owner', label: 'Owner', type: 'text', required: true },
        { id: 'repo', label: 'Repository', type: 'text', required: true },
        { id: 'path', label: 'File path', type: 'text', required: true, placeholder: 'README.md' },
        { id: 'ref', label: 'Branch / tag / sha', type: 'text' },
        { id: 'token', label: 'Personal access token (optional)', type: 'password' },
      ],
      run: load,
    },
  ],
};

registerForgeBlock(block);
export default block;
