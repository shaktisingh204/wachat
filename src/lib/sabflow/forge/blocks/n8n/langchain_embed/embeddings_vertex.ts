/**
 * Forge block: Embeddings Google Vertex AI
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/embeddings/EmbeddingsGoogleVertex
 *
 * Endpoint:
 *   POST https://{region}-aiplatform.googleapis.com/v1/projects/{projectId}
 *        /locations/{region}/publishers/google/models/{model}:predict
 *   Authorization: Bearer <accessToken>
 *
 * Vertex normally requires a service-account-signed JWT to obtain an OAuth
 * access token. To keep this block self-contained we accept the access token
 * directly (callers can refresh it upstream). `auth: { type: 'none' }`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function parseInput(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    return [String(parsed)];
  } catch {
    return [raw];
  }
}

async function embed(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = asString(ctx.options.accessToken);
  const projectId = asString(ctx.options.projectId);
  const region = asString(ctx.options.region) || 'us-central1';
  const model = asString(ctx.options.model) || 'text-embedding-004';
  if (!accessToken) throw new Error('Embeddings Vertex: accessToken is required');
  if (!projectId) throw new Error('Embeddings Vertex: projectId is required');
  const input = parseInput(asString(ctx.options.input));
  if (input.length === 0) throw new Error('Embeddings Vertex: input is required');

  const url =
    `https://${region}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
    `/locations/${encodeURIComponent(region)}/publishers/google/models/${encodeURIComponent(model)}:predict`;

  const res = await apiRequest({
    service: 'Embeddings Vertex',
    method: 'POST',
    url,
    headers: { Authorization: `Bearer ${accessToken}` },
    json: {
      instances: input.map((content) => ({ content })),
    },
  });
  const body = res.data as { predictions?: Array<{ embeddings?: { values?: number[] } }> };
  const vectors = (body?.predictions ?? []).map((p) => p?.embeddings?.values ?? []);
  return {
    outputs: { vectors, dimensions: vectors[0]?.length ?? 0, raw: res.data },
    logs: [`Embeddings Vertex → ${model} (${vectors.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_embeddings_vertex',
  name: 'Embeddings Google Vertex',
  description: 'Generate embeddings using Google Vertex AI publisher models.',
  iconName: 'LuSparkles',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'embed',
      label: 'Create embeddings',
      description: 'Embed one or more texts via Vertex AI.',
      fields: [
        { id: 'accessToken', label: 'OAuth access token', type: 'password', required: true },
        { id: 'projectId', label: 'GCP project id', type: 'text', required: true },
        { id: 'region', label: 'Region', type: 'text', placeholder: 'us-central1' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'text-embedding-004' },
        {
          id: 'input',
          label: 'Input (string or JSON array of strings)',
          type: 'textarea',
          required: true,
        },
      ],
      run: embed,
    },
  ],
};

registerForgeBlock(block);
export default block;
