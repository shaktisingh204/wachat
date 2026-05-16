/**
 * Forge block: Sanity.io
 *
 * Query / mutate Sanity datasets via the Content API:
 *   - GROQ query: GET /v2024-01-01/data/query/{dataset}?query=...
 *   - mutate:     POST /v2024-01-01/data/mutate/{dataset}
 *   - export:     GET /v2024-01-01/data/export/{dataset}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function baseUrl(projectId: string): string {
  return `https://${projectId}.api.sanity.io`;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.apiKey);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function query(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const dataset = asString(ctx.options.dataset) || 'production';
  const groq = asString(ctx.options.query);
  if (!projectId) throw new Error('Sanity: projectId is required');
  if (!groq) throw new Error('Sanity: query is required');
  const params = new URLSearchParams({ query: groq });
  const res = await apiRequest({
    service: 'Sanity',
    method: 'GET',
    url: `${baseUrl(projectId)}/v2024-01-01/data/query/${encodeURIComponent(dataset)}?${params.toString()}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Sanity query → ${dataset}`] };
}

async function mutate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const dataset = asString(ctx.options.dataset) || 'production';
  const token = asString(ctx.options.apiKey);
  const raw = asString(ctx.options.mutations);
  if (!projectId) throw new Error('Sanity: projectId is required');
  if (!token) throw new Error('Sanity: apiKey is required for mutations');
  if (!raw) throw new Error('Sanity: mutations is required');
  let mutations: unknown;
  try {
    mutations = JSON.parse(raw);
  } catch {
    throw new Error('Sanity: mutations must be valid JSON');
  }
  if (!Array.isArray(mutations)) throw new Error('Sanity: mutations must be a JSON array');
  const res = await apiRequest({
    service: 'Sanity',
    method: 'POST',
    url: `${baseUrl(projectId)}/v2024-01-01/data/mutate/${encodeURIComponent(dataset)}`,
    headers: authHeaders(ctx),
    json: { mutations },
  });
  return { outputs: { result: res.data }, logs: [`Sanity mutate → ${dataset} (${mutations.length} mutations)`] };
}

async function exportDataset(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const dataset = asString(ctx.options.dataset) || 'production';
  if (!projectId) throw new Error('Sanity: projectId is required');
  const res = await apiRequest({
    service: 'Sanity',
    method: 'GET',
    url: `${baseUrl(projectId)}/v2024-01-01/data/export/${encodeURIComponent(dataset)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Sanity export → ${dataset}`] };
}

const block: ForgeBlock = {
  id: 'forge_sanity',
  name: 'Sanity.io',
  description: 'Query, mutate and export Sanity content lake datasets.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'query',
      label: 'Query (GROQ)',
      fields: [
        { id: 'apiKey', label: 'API token (optional for public datasets)', type: 'password' },
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'dataset', label: 'Dataset', type: 'text', defaultValue: 'production' },
        { id: 'query', label: 'GROQ query', type: 'textarea', required: true, placeholder: '*[_type == "post"][0..10]' },
      ],
      run: query,
    },
    {
      id: 'mutate',
      label: 'Mutate',
      fields: [
        { id: 'apiKey', label: 'API token', type: 'password', required: true },
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'dataset', label: 'Dataset', type: 'text', defaultValue: 'production' },
        { id: 'mutations', label: 'Mutations (JSON array)', type: 'json', required: true },
      ],
      run: mutate,
    },
    {
      id: 'export',
      label: 'Export dataset',
      fields: [
        { id: 'apiKey', label: 'API token', type: 'password' },
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'dataset', label: 'Dataset', type: 'text', defaultValue: 'production' },
      ],
      run: exportDataset,
    },
  ],
};

registerForgeBlock(block);
export default block;
