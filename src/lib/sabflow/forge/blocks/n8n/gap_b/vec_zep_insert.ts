/**
 * Forge block: Zep (Insert)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreZepInsert
 *
 * Endpoint:
 *   POST {baseUrl}/api/v1/collection/{name}/document
 *
 * Auth: `Authorization: Bearer <apiKey>`.
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

type Vector = { id: string; vector: number[]; metadata?: Record<string, unknown>; content?: string };

function base(ctx: ForgeActionContext): { url: string; headers: Record<string, string> } {
  const baseUrl = asString(ctx.options.baseUrl).replace(/\/$/, '');
  const apiKey = asString(ctx.options.apiKey);
  if (!baseUrl) throw new Error('Zep (insert): baseUrl is required');
  if (!apiKey) throw new Error('Zep (insert): apiKey is required');
  return {
    url: baseUrl,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  };
}

function collection(ctx: ForgeActionContext): string {
  const c = asString(ctx.options.collection);
  if (!c) throw new Error('Zep (insert): collection is required');
  return c;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Zep (insert): vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('Zep (insert): each vector requires { id, vector[] }');
    return {
      id: String(o.id),
      vector: o.vector.map(Number),
      metadata: o.metadata,
      content: o.content,
    };
  });
}

async function insertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const { url, headers } = base(ctx);
  await apiRequest({
    service: 'Zep (insert)',
    method: 'POST',
    url: `${url}/api/v1/collection/${encodeURIComponent(collection(ctx))}/document`,
    headers,
    json: vectors.map((v) => ({
      document_id: v.id,
      content: v.content ?? '',
      embedding: v.vector,
      metadata: v.metadata ?? {},
    })),
  });
  return {
    outputs: { upserted: vectors.length },
    logs: [`Zep insert → ${vectors.length}`],
  };
}

const inlineCreds = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'http://localhost:8000' },
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_vec_zep_insert',
  name: 'Zep (Insert)',
  description: 'Insert-only Zep vector store action.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'insert_vectors',
      label: 'Add vectors',
      description: 'Upsert documents with embeddings into Zep.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, content?, metadata? })', type: 'textarea', required: true },
      ],
      run: insertVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
