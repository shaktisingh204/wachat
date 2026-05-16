/**
 * Forge block: Elasticsearch
 *
 * Source: n8n-master/packages/nodes-base/nodes/Elastic/Elasticsearch/Elasticsearch.node.ts
 *
 * Talks to an Elasticsearch cluster over HTTPS using HTTP Basic auth (user +
 * password baked into the action fields — no separate credential type).
 *
 * Operations covered:
 *   - doc.index   PUT/POST /<index>/_doc[/<id>]
 *   - doc.get     GET /<index>/_doc/<id>
 *   - doc.delete  DELETE /<index>/_doc/<id>
 *   - search      POST /<index>/_search
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { parseJson, parseJsonObject } from '../_shared/json';

function readBase(ctx: ForgeActionContext): { url: string; auth: string } {
  const baseUrl = asString(ctx.options.baseUrl).replace(/\/$/, '');
  if (!baseUrl) throw new Error('Elasticsearch: baseUrl is required (e.g. https://es.example.com:9200)');
  const user = asString(ctx.options.username);
  const pass = asString(ctx.options.password);
  if (!user || !pass) throw new Error('Elasticsearch: username and password are required');
  const auth = Buffer.from(`${user}:${pass}`).toString('base64');
  return { url: baseUrl, auth };
}

function authHeaders(auth: string): Record<string, string> {
  return { Authorization: `Basic ${auth}` };
}

async function docIndex(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, auth } = readBase(ctx);
  const index = asString(ctx.options.index);
  if (!index) throw new Error('Elasticsearch: index is required');
  const id = asString(ctx.options.id);
  const body = parseJsonObject(ctx.options.body, 'body');
  const path = id ? `/${encodeURIComponent(index)}/_doc/${encodeURIComponent(id)}` : `/${encodeURIComponent(index)}/_doc`;
  const res = await apiRequest({
    service: 'Elasticsearch',
    method: id ? 'PUT' : 'POST',
    url: `${url}${path}`,
    headers: authHeaders(auth),
    json: body,
  });
  return { outputs: { response: res.data }, logs: [`Elasticsearch doc.index → ${index}${id ? `/${id}` : ''}`] };
}

async function docGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, auth } = readBase(ctx);
  const index = asString(ctx.options.index);
  const id = asString(ctx.options.id);
  if (!index || !id) throw new Error('Elasticsearch: index and id are required');
  const res = await apiRequest({
    service: 'Elasticsearch',
    method: 'GET',
    url: `${url}/${encodeURIComponent(index)}/_doc/${encodeURIComponent(id)}`,
    headers: authHeaders(auth),
  });
  return { outputs: { document: res.data }, logs: [`Elasticsearch doc.get → ${index}/${id}`] };
}

async function docDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, auth } = readBase(ctx);
  const index = asString(ctx.options.index);
  const id = asString(ctx.options.id);
  if (!index || !id) throw new Error('Elasticsearch: index and id are required');
  const res = await apiRequest({
    service: 'Elasticsearch',
    method: 'DELETE',
    url: `${url}/${encodeURIComponent(index)}/_doc/${encodeURIComponent(id)}`,
    headers: authHeaders(auth),
  });
  return { outputs: { response: res.data }, logs: [`Elasticsearch doc.delete → ${index}/${id}`] };
}

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, auth } = readBase(ctx);
  const index = asString(ctx.options.index);
  if (!index) throw new Error('Elasticsearch: index is required');
  const query = parseJson(ctx.options.query, 'query') ?? { query: { match_all: {} } };
  const res = await apiRequest({
    service: 'Elasticsearch',
    method: 'POST',
    url: `${url}/${encodeURIComponent(index)}/_search`,
    headers: authHeaders(auth),
    json: query,
  });
  const data = res.data as { hits?: { hits?: unknown[]; total?: unknown } } | undefined;
  const hits = Array.isArray(data?.hits?.hits) ? data!.hits!.hits! : [];
  return {
    outputs: { hits, total: data?.hits?.total, response: res.data },
    logs: [`Elasticsearch search → ${hits.length} hit(s) from ${index}`],
  };
}

const AUTH_FIELDS = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'https://es.example.com:9200' },
  { id: 'username', label: 'Username', type: 'text' as const, required: true },
  { id: 'password', label: 'Password', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_elasticsearch',
  name: 'Elasticsearch',
  description: 'Index, get, delete and search documents in an Elasticsearch cluster.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'doc_index',
      label: 'Index document',
      description: 'PUT /<index>/_doc/<id> (or POST without id to auto-assign).',
      fields: [
        ...AUTH_FIELDS,
        { id: 'index', label: 'Index', type: 'text', required: true },
        { id: 'id', label: 'Document id (optional)', type: 'text' },
        { id: 'body', label: 'Document JSON', type: 'json', required: true, placeholder: '{"title":"Hello"}' },
      ],
      run: docIndex,
    },
    {
      id: 'doc_get',
      label: 'Get document',
      description: 'GET /<index>/_doc/<id>.',
      fields: [
        ...AUTH_FIELDS,
        { id: 'index', label: 'Index', type: 'text', required: true },
        { id: 'id', label: 'Document id', type: 'text', required: true },
      ],
      run: docGet,
    },
    {
      id: 'doc_delete',
      label: 'Delete document',
      description: 'DELETE /<index>/_doc/<id>.',
      fields: [
        ...AUTH_FIELDS,
        { id: 'index', label: 'Index', type: 'text', required: true },
        { id: 'id', label: 'Document id', type: 'text', required: true },
      ],
      run: docDelete,
    },
    {
      id: 'search',
      label: 'Search',
      description: 'POST /<index>/_search with an optional query DSL body.',
      fields: [
        ...AUTH_FIELDS,
        { id: 'index', label: 'Index', type: 'text', required: true },
        {
          id: 'query',
          label: 'Query DSL (JSON)',
          type: 'json',
          placeholder: '{"query":{"match":{"title":"hello"}}}',
        },
      ],
      run: search,
    },
  ],
};

registerForgeBlock(block);
export default block;
