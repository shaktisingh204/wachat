/**
 * Forge block: Pinecone (Insert)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStorePineconeInsert
 *
 * Endpoint:
 *   POST https://{index}-{project}.svc.{environment}.pinecone.io/vectors/upsert
 *
 * Header: `Api-Key: <apiKey>`.
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

function indexHost(ctx: ForgeActionContext): string {
  const index = asString(ctx.options.index);
  const project = asString(ctx.options.project);
  const env = asString(ctx.options.environment);
  if (!index || !project || !env)
    throw new Error('Pinecone (insert): index, project and environment are required');
  return `https://${index}-${project}.svc.${env}.pinecone.io`;
}

function headers(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Pinecone (insert): apiKey is required');
  return { 'Api-Key': apiKey, Accept: 'application/json' };
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Pinecone (insert): vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('Pinecone (insert): each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function insertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const namespace = asString(ctx.options.namespace);
  const res = await apiRequest({
    service: 'Pinecone (insert)',
    method: 'POST',
    url: `${indexHost(ctx)}/vectors/upsert`,
    headers: headers(ctx),
    json: {
      vectors: vectors.map((v) => ({ id: v.id, values: v.vector, metadata: v.metadata })),
      namespace: namespace || undefined,
    },
  });
  const body = res.data as { upsertedCount?: number };
  const upserted = body?.upsertedCount ?? vectors.length;
  return {
    outputs: { upserted, raw: res.data },
    logs: [`Pinecone insert → ${upserted}`],
  };
}

const inlineCreds = [
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
  { id: 'index', label: 'Index', type: 'text' as const, required: true },
  { id: 'project', label: 'Project ID', type: 'text' as const, required: true },
  { id: 'environment', label: 'Environment', type: 'text' as const, required: true, placeholder: 'us-east-1' },
];

const block: ForgeBlock = {
  id: 'forge_vec_pinecone_insert',
  name: 'Pinecone (Insert)',
  description: 'Insert-only Pinecone vector store action.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'insert_vectors',
      label: 'Add vectors',
      description: 'Upsert vectors into the index.',
      fields: [
        ...inlineCreds,
        { id: 'namespace', label: 'Namespace', type: 'text' },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: insertVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
