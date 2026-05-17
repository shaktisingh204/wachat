/**
 * Forge block: Pinecone (Load)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStorePineconeLoad
 *
 * Endpoint:
 *   POST https://{index}-{project}.svc.{environment}.pinecone.io/query
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
import { apiRequest, asNumber, asString } from '../_shared/http';

function indexHost(ctx: ForgeActionContext): string {
  const index = asString(ctx.options.index);
  const project = asString(ctx.options.project);
  const env = asString(ctx.options.environment);
  if (!index || !project || !env)
    throw new Error('Pinecone (load): index, project and environment are required');
  return `https://${index}-${project}.svc.${env}.pinecone.io`;
}

function headers(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Pinecone (load): apiKey is required');
  return { 'Api-Key': apiKey, Accept: 'application/json' };
}

async function loadVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Pinecone (load): query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const namespace = asString(ctx.options.namespace);
  const filterRaw = asString(ctx.options.filter);
  const filter = filterRaw ? (JSON.parse(filterRaw) as Record<string, unknown>) : undefined;

  const res = await apiRequest({
    service: 'Pinecone (load)',
    method: 'POST',
    url: `${indexHost(ctx)}/query`,
    headers: headers(ctx),
    json: {
      vector: queryVector,
      topK,
      namespace: namespace || undefined,
      filter,
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
    outputs: { results, raw: res.data },
    logs: [`Pinecone load → ${results.length}`],
  };
}

const inlineCreds = [
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
  { id: 'index', label: 'Index', type: 'text' as const, required: true },
  { id: 'project', label: 'Project ID', type: 'text' as const, required: true },
  { id: 'environment', label: 'Environment', type: 'text' as const, required: true, placeholder: 'us-east-1' },
];

const block: ForgeBlock = {
  id: 'forge_vec_pinecone_load',
  name: 'Pinecone (Load)',
  description: 'Load-only Pinecone vector store action.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'load_vectors',
      label: 'Search vectors',
      description: 'Query the Pinecone index by a vector.',
      fields: [
        ...inlineCreds,
        { id: 'namespace', label: 'Namespace', type: 'text' },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
        { id: 'filter', label: 'Filter (JSON)', type: 'textarea' },
      ],
      run: loadVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
