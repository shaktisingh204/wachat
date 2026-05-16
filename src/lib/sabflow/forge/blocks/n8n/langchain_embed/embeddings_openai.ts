/**
 * Forge block: Embeddings OpenAI
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/embeddings/EmbeddingsOpenAi
 *
 * Endpoint:
 *   POST https://api.openai.com/v1/embeddings  (Bearer <apiKey>)
 *
 * Inline credentials — block uses `auth: { type: 'none' }` and reads the
 * API key from a password field inside its action.
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
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Embeddings OpenAI: apiKey is required');
  const model = asString(ctx.options.model) || 'text-embedding-3-small';
  const input = parseInput(asString(ctx.options.input));
  if (input.length === 0) throw new Error('Embeddings OpenAI: input is required');

  const res = await apiRequest({
    service: 'Embeddings OpenAI',
    method: 'POST',
    url: 'https://api.openai.com/v1/embeddings',
    headers: { Authorization: `Bearer ${apiKey}` },
    json: { model, input },
  });
  const body = res.data as { data?: Array<{ embedding?: number[] }> };
  const vectors = (body?.data ?? []).map((d) => d.embedding ?? []);
  return {
    outputs: { vectors, dimensions: vectors[0]?.length ?? 0, raw: res.data },
    logs: [`Embeddings OpenAI → ${model} (${vectors.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_embeddings_openai',
  name: 'Embeddings OpenAI',
  description: 'Generate embeddings using OpenAI text-embedding models.',
  iconName: 'LuSparkles',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'embed',
      label: 'Create embeddings',
      description: 'Embed one or more texts into OpenAI vectors.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'text-embedding-3-small' },
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
