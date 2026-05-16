/**
 * Forge block: Embeddings Google Gemini
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/embeddings/EmbeddingsGoogleGemini
 *
 * Endpoint:
 *   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={apiKey}
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
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Embeddings Gemini: apiKey is required');
  const model = asString(ctx.options.model) || 'text-embedding-004';
  const input = parseInput(asString(ctx.options.input));
  if (input.length === 0) throw new Error('Embeddings Gemini: input is required');

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const vectors: number[][] = [];
  let lastRaw: unknown = null;
  // Gemini embedContent takes a single content per call.
  for (const text of input) {
    const res = await apiRequest({
      service: 'Embeddings Gemini',
      method: 'POST',
      url,
      json: {
        model: `models/${model}`,
        content: { parts: [{ text }] },
      },
    });
    const body = res.data as { embedding?: { values?: number[] } };
    vectors.push(body?.embedding?.values ?? []);
    lastRaw = res.data;
  }

  return {
    outputs: { vectors, dimensions: vectors[0]?.length ?? 0, raw: lastRaw },
    logs: [`Embeddings Gemini → ${model} (${vectors.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_embeddings_gemini',
  name: 'Embeddings Google Gemini',
  description: 'Generate embeddings using Google Gemini embedding models.',
  iconName: 'LuSparkles',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'embed',
      label: 'Create embeddings',
      description: 'Embed one or more texts into Gemini vectors.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
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
