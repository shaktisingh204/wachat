/**
 * Forge block: Embeddings Azure OpenAI
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/embeddings/EmbeddingsAzureOpenAi
 *
 * Endpoint:
 *   POST <endpoint>/openai/deployments/{deployment}/embeddings
 *        ?api-version=2024-02-15-preview
 *   Header: api-key: <apiKey>
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
  const endpoint = asString(ctx.options.endpoint).replace(/\/+$/, '');
  const apiKey = asString(ctx.options.apiKey);
  const deployment = asString(ctx.options.deployment);
  const apiVersion = asString(ctx.options.apiVersion) || '2024-02-15-preview';
  if (!endpoint) throw new Error('Embeddings Azure OpenAI: endpoint is required');
  if (!apiKey) throw new Error('Embeddings Azure OpenAI: apiKey is required');
  if (!deployment) throw new Error('Embeddings Azure OpenAI: deployment is required');
  const input = parseInput(asString(ctx.options.input));
  if (input.length === 0) throw new Error('Embeddings Azure OpenAI: input is required');

  const url =
    `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/embeddings` +
    `?api-version=${encodeURIComponent(apiVersion)}`;

  const res = await apiRequest({
    service: 'Embeddings Azure OpenAI',
    method: 'POST',
    url,
    headers: { 'api-key': apiKey },
    json: { input },
  });
  const body = res.data as { data?: Array<{ embedding?: number[] }> };
  const vectors = (body?.data ?? []).map((d) => d.embedding ?? []);
  return {
    outputs: { vectors, dimensions: vectors[0]?.length ?? 0, raw: res.data },
    logs: [`Embeddings Azure OpenAI → ${deployment} (${vectors.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_embeddings_azure_openai',
  name: 'Embeddings Azure OpenAI',
  description: 'Generate embeddings using an Azure OpenAI deployment.',
  iconName: 'LuSparkles',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'embed',
      label: 'Create embeddings',
      description: 'Embed one or more texts via Azure OpenAI.',
      fields: [
        {
          id: 'endpoint',
          label: 'Endpoint',
          type: 'text',
          placeholder: 'https://my-resource.openai.azure.com',
          required: true,
        },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'deployment', label: 'Deployment name', type: 'text', required: true },
        { id: 'apiVersion', label: 'API version', type: 'text', placeholder: '2024-02-15-preview' },
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
