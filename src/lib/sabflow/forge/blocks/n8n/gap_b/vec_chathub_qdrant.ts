/**
 * Forge block: Chat Hub — Qdrant
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreQdrant
 *   (Chat-hub variant — points carry a `session_id` payload field and queries
 *   filter on it.)
 *
 * Endpoints:
 *   PUT    {baseUrl}/collections/{collection}/points          (upsert)
 *   POST   {baseUrl}/collections/{collection}/points/search   (query)
 *   POST   {baseUrl}/collections/{collection}/points/delete   (delete)
 *
 * Inline credentials — `auth: { type: 'none' }`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

type Vector = { id: string | number; vector: number[]; metadata?: Record<string, unknown> };

function base(ctx: ForgeActionContext): { url: string; headers: Record<string, string> } {
  const baseUrl = asString(ctx.options.baseUrl).replace(/\/$/, '');
  if (!baseUrl) throw new Error('Chat-Hub Qdrant: baseUrl is required');
  const headers: Record<string, string> = { Accept: 'application/json' };
  const apiKey = asString(ctx.options.apiKey);
  if (apiKey) headers['api-key'] = apiKey;
  return { url: baseUrl, headers };
}

function collection(ctx: ForgeActionContext): string {
  const c = asString(ctx.options.collection);
  if (!c) throw new Error('Chat-Hub Qdrant: collection is required');
  return c;
}

function sessionId(ctx: ForgeActionContext): string {
  const s = asString(ctx.options.sessionId);
  if (!s) throw new Error('Chat-Hub Qdrant: sessionId is required');
  return s;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Chat-Hub Qdrant: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (o?.id == null || !Array.isArray(o.vector))
      throw new Error('Chat-Hub Qdrant: each vector requires { id, vector[] }');
    return { id: o.id, vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const sid = sessionId(ctx);
  const { url, headers } = base(ctx);
  await apiRequest({
    service: 'Chat-Hub Qdrant',
    method: 'PUT',
    url: `${url}/collections/${encodeURIComponent(collection(ctx))}/points`,
    headers,
    json: {
      points: vectors.map((v) => ({
        id: v.id,
        vector: v.vector,
        payload: { ...(v.metadata ?? {}), session_id: sid },
      })),
    },
  });
  return {
    outputs: { upserted: vectors.length, sessionId: sid },
    logs: [`Chat-Hub Qdrant upsert → ${vectors.length} (session ${sid})`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Chat-Hub Qdrant: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const sid = sessionId(ctx);
  const { url, headers } = base(ctx);

  const res = await apiRequest({
    service: 'Chat-Hub Qdrant',
    method: 'POST',
    url: `${url}/collections/${encodeURIComponent(collection(ctx))}/points/search`,
    headers,
    json: {
      vector: queryVector,
      limit: topK,
      filter: { must: [{ key: 'session_id', match: { value: sid } }] },
      with_payload: true,
    },
  });
  const body = res.data as { result?: Array<{ id: string | number; score: number; payload?: Record<string, unknown> }> };
  const results = (body?.result ?? []).map((m) => ({
    id: m.id,
    score: m.score,
    metadata: m.payload ?? {},
  }));
  return {
    outputs: { results, sessionId: sid, raw: res.data },
    logs: [`Chat-Hub Qdrant query → ${results.length} (session ${sid})`],
  };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sid = sessionId(ctx);
  const { url, headers } = base(ctx);
  await apiRequest({
    service: 'Chat-Hub Qdrant',
    method: 'POST',
    url: `${url}/collections/${encodeURIComponent(collection(ctx))}/points/delete`,
    headers,
    json: { filter: { must: [{ key: 'session_id', match: { value: sid } }] } },
  });
  return {
    outputs: { cleared: true, sessionId: sid },
    logs: [`Chat-Hub Qdrant cleared session ${sid}`],
  };
}

const inlineCreds = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'http://localhost:6333' },
  { id: 'apiKey', label: 'API key (optional)', type: 'password' as const },
];

const block: ForgeBlock = {
  id: 'forge_vec_chathub_qdrant',
  name: 'Chat Hub — Qdrant',
  description:
    'Per-session vector store backed by Qdrant. Points carry a session_id payload and queries filter on it.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Upsert points with session metadata.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: upsertVectors,
    },
    {
      id: 'query_vectors',
      label: 'Search vectors',
      description: 'Search Qdrant filtered to the current session.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
      ],
      run: queryVectors,
    },
    {
      id: 'clear_session',
      label: 'Clear session',
      description: 'Delete every point matching the session id.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
      ],
      run: clearSession,
    },
  ],
};

registerForgeBlock(block);
export default block;
