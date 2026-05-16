/**
 * Forge block: Embeddings Cohere
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/embeddings/EmbeddingsCohere
 *
 * Endpoint:
 *   POST https://api.cohere.com/v2/embed   (Bearer <apiKey>)
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

function parseTexts(raw: string): string[] {
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
  if (!apiKey) throw new Error('Embeddings Cohere: apiKey is required');
  const model = asString(ctx.options.model) || 'embed-multilingual-v3.0';
  const inputType = asString(ctx.options.inputType) || 'search_document';
  const texts = parseTexts(asString(ctx.options.texts));
  if (texts.length === 0) throw new Error('Embeddings Cohere: texts is required');

  const res = await apiRequest({
    service: 'Embeddings Cohere',
    method: 'POST',
    url: 'https://api.cohere.com/v2/embed',
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      texts,
      input_type: inputType,
      embedding_types: ['float'],
    },
  });
  const body = res.data as { embeddings?: { float?: number[][] } | number[][] };
  let vectors: number[][] = [];
  if (Array.isArray(body?.embeddings)) {
    vectors = body.embeddings;
  } else if (body?.embeddings && Array.isArray(body.embeddings.float)) {
    vectors = body.embeddings.float;
  }
  return {
    outputs: { vectors, dimensions: vectors[0]?.length ?? 0, raw: res.data },
    logs: [`Embeddings Cohere → ${model} (${vectors.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_embeddings_cohere',
  name: 'Embeddings Cohere',
  description: 'Generate embeddings using Cohere embed models.',
  iconName: 'LuSparkles',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'embed',
      label: 'Create embeddings',
      description: 'Embed one or more texts into Cohere vectors.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'embed-multilingual-v3.0' },
        {
          id: 'inputType',
          label: 'Input type',
          type: 'select',
          options: [
            { label: 'search_document', value: 'search_document' },
            { label: 'search_query', value: 'search_query' },
            { label: 'classification', value: 'classification' },
            { label: 'clustering', value: 'clustering' },
          ],
          defaultValue: 'search_document',
        },
        {
          id: 'texts',
          label: 'Texts (string or JSON array of strings)',
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
