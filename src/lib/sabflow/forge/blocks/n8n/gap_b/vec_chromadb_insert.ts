/**
 * Forge block: ChromaDB (Insert)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreChromaInsert
 *
 * Endpoint:
 *   POST {baseUrl}/api/v1/collections/{id}/upsert
 *
 * Inline credentials — `auth: { type: 'none' }`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

type Vector = { id: string; vector: number[]; metadata?: Record<string, unknown> };

function base(ctx: ForgeActionContext): { url: string; headers: Record<string, string> } {
  const baseUrl = asString(ctx.options.baseUrl).replace(/\/$/, '');
  if (!baseUrl) throw new Error('ChromaDB (insert): baseUrl is required');
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = asString(ctx.options.token);
  if (token) headers.Authorization = `Bearer ${token}`;
  return { url: baseUrl, headers };
}

function collectionId(ctx: ForgeActionContext): string {
  const c = asString(ctx.options.collection);
  if (!c) throw new Error('ChromaDB (insert): collection (id) is required');
  return c;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('ChromaDB (insert): vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('ChromaDB (insert): each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function insertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const { url, headers } = base(ctx);
  await apiRequest({
    service: 'ChromaDB (insert)',
    method: 'POST',
    url: `${url}/api/v1/collections/${encodeURIComponent(collectionId(ctx))}/upsert`,
    headers,
    json: {
      ids: vectors.map((v) => v.id),
      embeddings: vectors.map((v) => v.vector),
      metadatas: vectors.map((v) => v.metadata ?? {}),
    },
  });
  return {
    outputs: { upserted: vectors.length },
    logs: [`ChromaDB insert → ${vectors.length}`],
  };
}

const inlineCreds = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'http://localhost:8000' },
  { id: 'token', label: 'Bearer token (optional)', type: 'password' as const },
];

const block: ForgeBlock = {
  id: 'forge_vec_chromadb_insert',
  name: 'ChromaDB (Insert)',
  description: 'Insert-only ChromaDB vector store action.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'insert_vectors',
      label: 'Add vectors',
      description: 'Upsert vectors into a Chroma collection.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection ID', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: insertVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
