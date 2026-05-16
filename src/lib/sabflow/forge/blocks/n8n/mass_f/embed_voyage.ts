/**
 * Forge block: Embed Voyage AI
 *
 * Generates text embeddings with Voyage AI
 * (`https://api.voyageai.com/v1/embeddings`).
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.voyageai.com/v1/embeddings';

async function embed(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Voyage: apiKey is required');
  const text = asString(ctx.options.text);
  if (!text) throw new Error('Voyage: text is required');
  const model = asString(ctx.options.model) || 'voyage-3';
  const inputType = asString(ctx.options.inputType);

  const body: Record<string, unknown> = { input: [text], model };
  if (inputType) body.input_type = inputType;

  const res = await apiRequest({
    service: 'Voyage',
    method: 'POST',
    url: API,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: body,
  });
  const data = res.data as {
    data?: Array<{ embedding?: number[]; index?: number }>;
    model?: string;
    usage?: { total_tokens?: number };
  };
  const embedding = data?.data?.[0]?.embedding ?? [];
  return {
    outputs: {
      embedding,
      dimensions: embedding.length,
      model: data?.model ?? model,
      totalTokens: data?.usage?.total_tokens,
      raw: res.data,
    },
    logs: [`Voyage embed → ${embedding.length}d`],
  };
}

const block: ForgeBlock = {
  id: 'forge_embed_voyage',
  name: 'Embed Voyage AI',
  description: 'Generate text embeddings with Voyage AI.',
  iconName: 'LuVector',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'embed',
      label: 'Embed text',
      description: 'Return an embedding vector for a single text input.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'voyage-3', placeholder: 'voyage-3, voyage-3-lite, voyage-large-2…' },
        { id: 'inputType', label: 'Input type', type: 'text', placeholder: 'query | document' },
      ],
      run: embed,
    },
  ],
};

registerForgeBlock(block);
export default block;
