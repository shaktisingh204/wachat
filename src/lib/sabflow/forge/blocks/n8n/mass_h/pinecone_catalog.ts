/**
 * Forge block: Pinecone (catalog)
 *
 * Manage Pinecone indexes (list/create/describe/delete) via the control plane
 * API. Auth: `Api-Key` header.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.pinecone.io';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Pinecone: apiKey is required');
  return { 'Api-Key': apiKey, 'X-Pinecone-API-Version': '2024-07' };
}

async function listIndexes(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Pinecone',
    method: 'GET',
    url: `${API}/indexes`,
    headers: authHeaders(ctx),
  });
  return { outputs: { indexes: res.data }, logs: ['Pinecone list indexes'] };
}

async function describeIndex(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.indexName);
  if (!name) throw new Error('Pinecone: indexName is required');
  const res = await apiRequest({
    service: 'Pinecone',
    method: 'GET',
    url: `${API}/indexes/${encodeURIComponent(name)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { index: res.data }, logs: [`Pinecone describe index → ${name}`] };
}

async function createIndex(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.indexName);
  const dimension = asNumber(ctx.options.dimension);
  const metric = asString(ctx.options.metric) || 'cosine';
  const cloud = asString(ctx.options.cloud) || 'aws';
  const region = asString(ctx.options.region) || 'us-east-1';
  if (!name) throw new Error('Pinecone: indexName is required');
  if (!dimension) throw new Error('Pinecone: dimension is required');
  const res = await apiRequest({
    service: 'Pinecone',
    method: 'POST',
    url: `${API}/indexes`,
    headers: authHeaders(ctx),
    json: { name, dimension, metric, spec: { serverless: { cloud, region } } },
  });
  return { outputs: { index: res.data }, logs: [`Pinecone create index → ${name}`] };
}

async function deleteIndex(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.indexName);
  if (!name) throw new Error('Pinecone: indexName is required');
  await apiRequest({
    service: 'Pinecone',
    method: 'DELETE',
    url: `${API}/indexes/${encodeURIComponent(name)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { deleted: true, indexName: name }, logs: [`Pinecone delete index → ${name}`] };
}

const block: ForgeBlock = {
  id: 'forge_pinecone_catalog',
  name: 'Pinecone (catalog)',
  description: 'Manage Pinecone indexes — list, describe, create, delete.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_indexes',
      label: 'List indexes',
      fields: [{ id: 'apiKey', label: 'API key', type: 'password', required: true }],
      run: listIndexes,
    },
    {
      id: 'describe_index',
      label: 'Describe index',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'indexName', label: 'Index name', type: 'text', required: true },
      ],
      run: describeIndex,
    },
    {
      id: 'create_index',
      label: 'Create index',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'indexName', label: 'Index name', type: 'text', required: true },
        { id: 'dimension', label: 'Dimension', type: 'number', required: true },
        { id: 'metric', label: 'Metric', type: 'select', options: [
          { label: 'Cosine', value: 'cosine' },
          { label: 'Euclidean', value: 'euclidean' },
          { label: 'Dot product', value: 'dotproduct' },
        ], defaultValue: 'cosine' },
        { id: 'cloud', label: 'Cloud', type: 'text', defaultValue: 'aws' },
        { id: 'region', label: 'Region', type: 'text', defaultValue: 'us-east-1' },
      ],
      run: createIndex,
    },
    {
      id: 'delete_index',
      label: 'Delete index',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'indexName', label: 'Index name', type: 'text', required: true },
      ],
      run: deleteIndex,
    },
  ],
};

registerForgeBlock(block);
export default block;
