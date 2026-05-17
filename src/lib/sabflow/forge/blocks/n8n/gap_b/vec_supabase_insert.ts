/**
 * Forge block: Supabase Vector (Insert)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreSupabaseInsert
 *
 * Endpoint:
 *   POST {baseUrl}/rest/v1/{table}  (Prefer: resolution=merge-duplicates)
 *
 * Headers: `apikey: <serviceKey>` + `Authorization: Bearer <serviceKey>`.
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
  const apiKey = asString(ctx.options.apiKey);
  if (!baseUrl) throw new Error('Supabase (insert): baseUrl is required');
  if (!apiKey) throw new Error('Supabase (insert): apiKey is required');
  return {
    url: baseUrl,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  };
}

function table(ctx: ForgeActionContext): string {
  const t = asString(ctx.options.table);
  if (!t) throw new Error('Supabase (insert): table is required');
  return t;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Supabase (insert): vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('Supabase (insert): each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function insertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const { url, headers } = base(ctx);
  await apiRequest({
    service: 'Supabase (insert)',
    method: 'POST',
    url: `${url}/rest/v1/${encodeURIComponent(table(ctx))}`,
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    json: vectors.map((v) => ({
      id: v.id,
      embedding: v.vector,
      metadata: v.metadata ?? {},
    })),
  });
  return {
    outputs: { upserted: vectors.length },
    logs: [`Supabase insert → ${vectors.length}`],
  };
}

const inlineCreds = [
  { id: 'baseUrl', label: 'Project URL', type: 'text' as const, required: true, placeholder: 'https://xxxx.supabase.co' },
  { id: 'apiKey', label: 'Service role key', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_vec_supabase_insert',
  name: 'Supabase Vector (Insert)',
  description: 'Insert-only Supabase vector store action.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'insert_vectors',
      label: 'Add vectors',
      description: 'Upsert vectors via Supabase REST.',
      fields: [
        ...inlineCreds,
        { id: 'table', label: 'Table', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: insertVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
