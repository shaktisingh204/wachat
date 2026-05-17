/**
 * Forge block: Chat Hub — Pinecone
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStorePinecone
 *   (Chat-hub variant — same Pinecone index but every vector carries a
 *   `session_id` metadata field and queries filter on it.)
 *
 * Endpoints (per-index host):
 *   POST   https://{index}-{project}.svc.{environment}.pinecone.io/vectors/upsert
 *   POST   https://{index}-{project}.svc.{environment}.pinecone.io/query
 *   POST   https://{index}-{project}.svc.{environment}.pinecone.io/vectors/delete
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

type Vector = { id: string; vector: number[]; metadata?: Record<string, unknown> };

function indexHost(ctx: ForgeActionContext): string {
  const index = asString(ctx.options.index);
  const project = asString(ctx.options.project);
  const env = asString(ctx.options.environment);
  if (!index || !project || !env)
    throw new Error('Chat-Hub Pinecone: index, project and environment are required');
  return `https://${index}-${project}.svc.${env}.pinecone.io`;
}

function headers(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Chat-Hub Pinecone: apiKey is required');
  return { 'Api-Key': apiKey, Accept: 'application/json' };
}

function sessionId(ctx: ForgeActionContext): string {
  const s = asString(ctx.options.sessionId);
  if (!s) throw new Error('Chat-Hub Pinecone: sessionId is required');
  return s;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Chat-Hub Pinecone: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('Chat-Hub Pinecone: each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const sid = sessionId(ctx);
  const namespace = asString(ctx.options.namespace) || sid;
  const res = await apiRequest({
    service: 'Chat-Hub Pinecone',
    method: 'POST',
    url: `${indexHost(ctx)}/vectors/upsert`,
    headers: headers(ctx),
    json: {
      vectors: vectors.map((v) => ({
        id: v.id,
        values: v.vector,
        metadata: { ...(v.metadata ?? {}), session_id: sid },
      })),
      namespace,
    },
  });
  const body = res.data as { upsertedCount?: number };
  const upserted = body?.upsertedCount ?? vectors.length;
  return {
    outputs: { upserted, sessionId: sid, raw: res.data },
    logs: [`Chat-Hub Pinecone upsert → ${upserted} (session ${sid})`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Chat-Hub Pinecone: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const sid = sessionId(ctx);
  const namespace = asString(ctx.options.namespace) || sid;

  const res = await apiRequest({
    service: 'Chat-Hub Pinecone',
    method: 'POST',
    url: `${indexHost(ctx)}/query`,
    headers: headers(ctx),
    json: {
      vector: queryVector,
      topK,
      namespace,
      filter: { session_id: { $eq: sid } },
      includeMetadata: true,
    },
  });
  const body = res.data as { matches?: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> };
  const results = (body?.matches ?? []).map((m) => ({
    id: m.id,
    score: m.score,
    metadata: m.metadata ?? {},
  }));
  return {
    outputs: { results, sessionId: sid, raw: res.data },
    logs: [`Chat-Hub Pinecone query → ${results.length} (session ${sid})`],
  };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sid = sessionId(ctx);
  const namespace = asString(ctx.options.namespace) || sid;
  await apiRequest({
    service: 'Chat-Hub Pinecone',
    method: 'POST',
    url: `${indexHost(ctx)}/vectors/delete`,
    headers: headers(ctx),
    json: { deleteAll: true, namespace },
  });
  return {
    outputs: { cleared: true, sessionId: sid },
    logs: [`Chat-Hub Pinecone cleared namespace ${namespace}`],
  };
}

const inlineCreds = [
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
  { id: 'index', label: 'Index', type: 'text' as const, required: true },
  { id: 'project', label: 'Project ID', type: 'text' as const, required: true },
  { id: 'environment', label: 'Environment', type: 'text' as const, required: true, placeholder: 'us-east-1' },
];

const block: ForgeBlock = {
  id: 'forge_vec_chathub_pinecone',
  name: 'Chat Hub — Pinecone',
  description:
    'Per-session vector store backed by Pinecone. Vectors carry a session_id metadata field and queries filter on it.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Upsert vectors with session metadata.',
      fields: [
        ...inlineCreds,
        { id: 'namespace', label: 'Namespace (defaults to sessionId)', type: 'text' },
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: upsertVectors,
    },
    {
      id: 'query_vectors',
      label: 'Search vectors',
      description: 'Query Pinecone filtered to the current session.',
      fields: [
        ...inlineCreds,
        { id: 'namespace', label: 'Namespace (defaults to sessionId)', type: 'text' },
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
      ],
      run: queryVectors,
    },
    {
      id: 'clear_session',
      label: 'Clear session',
      description: 'Delete every vector in the session namespace.',
      fields: [
        ...inlineCreds,
        { id: 'namespace', label: 'Namespace (defaults to sessionId)', type: 'text' },
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
      ],
      run: clearSession,
    },
  ],
};

registerForgeBlock(block);
export default block;
