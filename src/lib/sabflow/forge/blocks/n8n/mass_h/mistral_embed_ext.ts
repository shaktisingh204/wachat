/**
 * Forge block: Mistral Embed (extended)
 *
 * `https://api.mistral.ai/v1/embeddings` + list models.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.mistral.ai/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Mistral: apiKey is required');
  return { Authorization: `Bearer ${apiKey}` };
}

async function embedText(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'mistral-embed';
  const inputRaw = asString(ctx.options.input);
  if (!inputRaw) throw new Error('Mistral: input is required');
  const inputs = inputRaw.includes('\n')
    ? inputRaw.split('\n').map((s) => s.trim()).filter(Boolean)
    : [inputRaw];
  const res = await apiRequest({
    service: 'Mistral',
    method: 'POST',
    url: `${API}/embeddings`,
    headers: authHeaders(ctx),
    json: { model, input: inputs },
  });
  return { outputs: { embeddings: res.data }, logs: [`Mistral embeddings → ${model} (${inputs.length} inputs)`] };
}

async function embedBatch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'mistral-embed';
  const raw = asString(ctx.options.inputsJson);
  if (!raw) throw new Error('Mistral: inputsJson is required');
  let inputs: unknown;
  try {
    inputs = JSON.parse(raw);
  } catch {
    throw new Error('Mistral: inputsJson must be valid JSON');
  }
  if (!Array.isArray(inputs)) throw new Error('Mistral: inputsJson must be a JSON array of strings');
  const res = await apiRequest({
    service: 'Mistral',
    method: 'POST',
    url: `${API}/embeddings`,
    headers: authHeaders(ctx),
    json: { model, input: inputs },
  });
  return { outputs: { embeddings: res.data }, logs: [`Mistral embeddings batch → ${model} (${inputs.length} inputs)`] };
}

async function listModels(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Mistral',
    method: 'GET',
    url: `${API}/models`,
    headers: authHeaders(ctx),
  });
  return { outputs: { models: res.data }, logs: ['Mistral list models'] };
}

const block: ForgeBlock = {
  id: 'forge_mistral_embed_ext',
  name: 'Mistral Embed (extended)',
  description: 'Generate embeddings via Mistral /v1/embeddings (single, batch) and list models.',
  iconName: 'LuBot',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'embed_text',
      label: 'Embed text',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'mistral-embed' },
        { id: 'input', label: 'Input (one per line)', type: 'textarea', required: true },
      ],
      run: embedText,
    },
    {
      id: 'embed_batch',
      label: 'Embed batch (JSON array)',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'mistral-embed' },
        { id: 'inputsJson', label: 'Inputs (JSON array)', type: 'json', required: true },
      ],
      run: embedBatch,
    },
    {
      id: 'list_models',
      label: 'List models',
      fields: [{ id: 'apiKey', label: 'API key', type: 'password', required: true }],
      run: listModels,
    },
  ],
};

registerForgeBlock(block);
export default block;
