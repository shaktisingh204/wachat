/**
 * Forge block: Embeddings Lemonade
 *
 * Lemonade SDK exposes an OpenAI-compatible embeddings endpoint
 * (POST /api/v1/embeddings).
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
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
  const baseUrl = (asString(ctx.options.baseUrl) || 'http://localhost:8000').replace(/\/+$/, '');
  const model = asString(ctx.options.model) || 'text-embedding-3-small';
  const input = parseInput(asString(ctx.options.input));
  if (input.length === 0) throw new Error('Embeddings Lemonade: input is required');

  const res = await apiRequest({
    service: 'Embeddings Lemonade',
    method: 'POST',
    url: `${baseUrl}/api/v1/embeddings`,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    json: { model, input },
  });
  const body = res.data as { data?: Array<{ embedding?: number[] }> };
  const vectors = (body?.data ?? []).map((d) => d.embedding ?? []);
  return {
    outputs: { vectors, dimensions: vectors[0]?.length ?? 0, raw: res.data },
    logs: [`Embeddings Lemonade → ${model} (${vectors.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_embeddings_lemonade',
  name: 'Embeddings Lemonade',
  description: 'Generate embeddings via local Lemonade SDK (OpenAI-compatible).',
  iconName: 'LuSparkles',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'embed',
      label: 'Create embeddings',
      description: 'Embed one or more texts via Lemonade /api/v1/embeddings.',
      fields: [
        { id: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'http://localhost:8000' },
        { id: 'apiKey', label: 'API key (optional)', type: 'password' },
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
