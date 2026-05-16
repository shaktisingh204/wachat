/**
 * Forge block: Embeddings Ollama
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/embeddings/EmbeddingsOllama
 *
 * Endpoint:
 *   POST <baseUrl>/api/embeddings  (no auth — local/private server)
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
  const baseUrl = (asString(ctx.options.baseUrl) || 'http://localhost:11434').replace(/\/+$/, '');
  const model = asString(ctx.options.model) || 'nomic-embed-text';
  const input = parseInput(asString(ctx.options.input));
  if (input.length === 0) throw new Error('Embeddings Ollama: input is required');

  const vectors: number[][] = [];
  let lastRaw: unknown = null;
  // Ollama's /api/embeddings takes a single `prompt` per call.
  for (const prompt of input) {
    const res = await apiRequest({
      service: 'Embeddings Ollama',
      method: 'POST',
      url: `${baseUrl}/api/embeddings`,
      json: { model, prompt },
    });
    const body = res.data as { embedding?: number[] };
    vectors.push(body?.embedding ?? []);
    lastRaw = res.data;
  }

  return {
    outputs: { vectors, dimensions: vectors[0]?.length ?? 0, raw: lastRaw },
    logs: [`Embeddings Ollama → ${model} (${vectors.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_embeddings_ollama',
  name: 'Embeddings Ollama',
  description: 'Generate embeddings using a self-hosted Ollama server.',
  iconName: 'LuSparkles',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'embed',
      label: 'Create embeddings',
      description: 'Embed one or more texts via Ollama.',
      fields: [
        {
          id: 'baseUrl',
          label: 'Base URL',
          type: 'text',
          placeholder: 'http://localhost:11434',
          required: true,
        },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'nomic-embed-text' },
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
