/**
 * Forge block: Embeddings Hugging Face Inference
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/embeddings/EmbeddingsHuggingFaceInference
 *
 * Endpoint:
 *   POST https://api-inference.huggingface.co/models/{model}
 *   Authorization: Bearer <apiKey>
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

function isNumberMatrix(value: unknown): value is number[][] {
  return Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every((n) => typeof n === 'number'));
}

function isNumberVector(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((n) => typeof n === 'number');
}

async function embed(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Embeddings Hugging Face: apiKey is required');
  const model = asString(ctx.options.model) || 'sentence-transformers/all-MiniLM-L6-v2';
  const input = parseInput(asString(ctx.options.input));
  if (input.length === 0) throw new Error('Embeddings Hugging Face: input is required');

  const res = await apiRequest({
    service: 'Embeddings Hugging Face',
    method: 'POST',
    url: `https://api-inference.huggingface.co/models/${model}`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: { inputs: input, options: { wait_for_model: true } },
  });
  let vectors: number[][] = [];
  if (isNumberMatrix(res.data)) {
    vectors = res.data;
  } else if (isNumberVector(res.data)) {
    vectors = [res.data];
  }
  return {
    outputs: { vectors, dimensions: vectors[0]?.length ?? 0, raw: res.data },
    logs: [`Embeddings Hugging Face → ${model} (${vectors.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_embeddings_huggingface',
  name: 'Embeddings Hugging Face',
  description: 'Generate embeddings using a Hugging Face Inference model.',
  iconName: 'LuSparkles',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'embed',
      label: 'Create embeddings',
      description: 'Embed one or more texts via Hugging Face Inference.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        {
          id: 'model',
          label: 'Model',
          type: 'text',
          placeholder: 'sentence-transformers/all-MiniLM-L6-v2',
        },
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
