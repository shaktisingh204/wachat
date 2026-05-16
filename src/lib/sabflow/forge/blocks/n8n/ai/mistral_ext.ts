/**
 * Forge block: Mistral AI (extended)
 *
 * Source: n8n-master/packages/nodes-base/nodes/MistralAI/MistralAi.node.ts
 * Credential type: 'mistral' (expects { apiKey }).
 *
 * Operations against https://api.mistral.ai/v1 :
 *   - chat          POST /chat/completions
 *   - embed         POST /embeddings
 *   - moderate      POST /moderations
 *   - models        GET  /models
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const API = 'https://api.mistral.ai/v1';

function bearer(ctx: ForgeActionContext): string {
  const cred = requireCredential('Mistral', ctx.credential);
  const key = cred.apiKey ?? cred.accessToken;
  if (!key) throw new Error('Mistral: credential is missing `apiKey`');
  return `Bearer ${key}`;
}

function parseMessages(raw: unknown): Array<{ role: string; content: string }> {
  const s = asString(raw).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fallthrough */
  }
  return [{ role: 'user', content: s }];
}

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'mistral-small-latest';
  const messages = parseMessages(ctx.options.messages);
  if (messages.length === 0) throw new Error('Mistral chat: messages are required');

  const payload: Record<string, unknown> = { model, messages };
  if (ctx.options.temperature !== undefined && ctx.options.temperature !== '') {
    payload.temperature = Number(ctx.options.temperature);
  }
  if (ctx.options.maxTokens) payload.max_tokens = Number(ctx.options.maxTokens);

  const res = await apiRequest({
    service: 'Mistral',
    method: 'POST',
    url: `${API}/chat/completions`,
    headers: { Authorization: bearer(ctx) },
    json: payload,
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  return {
    outputs: { content: body?.choices?.[0]?.message?.content ?? '', raw: res.data },
    logs: [`Mistral chat → ${model}`],
  };
}

async function embed(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const input = asString(ctx.options.input);
  if (!input) throw new Error('Mistral embed: input is required');
  const model = asString(ctx.options.model) || 'mistral-embed';

  const res = await apiRequest({
    service: 'Mistral',
    method: 'POST',
    url: `${API}/embeddings`,
    headers: { Authorization: bearer(ctx) },
    json: { model, input: [input] },
  });
  const body = res.data as { data?: Array<{ embedding?: number[] }> };
  return {
    outputs: { embedding: body?.data?.[0]?.embedding ?? [], raw: res.data },
    logs: [`Mistral embed → ${model}`],
  };
}

async function moderate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const input = asString(ctx.options.input);
  if (!input) throw new Error('Mistral moderate: input is required');
  const model = asString(ctx.options.model) || 'mistral-moderation-latest';

  const res = await apiRequest({
    service: 'Mistral',
    method: 'POST',
    url: `${API}/moderations`,
    headers: { Authorization: bearer(ctx) },
    json: { model, input: [input] },
  });
  return {
    outputs: { result: res.data },
    logs: [`Mistral moderate → ${model}`],
  };
}

async function listModels(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Mistral',
    method: 'GET',
    url: `${API}/models`,
    headers: { Authorization: bearer(ctx) },
  });
  const body = res.data as { data?: Array<{ id?: string }> };
  return {
    outputs: { models: body?.data ?? [], count: body?.data?.length ?? 0 },
    logs: [`Mistral models (${body?.data?.length ?? 0})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_mistral_ext',
  name: 'Mistral AI (extended)',
  description: 'Chat, embed and moderate text with Mistral.',
  iconName: 'LuSparkles',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mistral' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      description: 'Run a chat completion.',
      fields: [
        { id: 'model', label: 'Model', type: 'text', placeholder: 'mistral-small-latest' },
        { id: 'messages', label: 'Messages', type: 'textarea', required: true, placeholder: '[{"role":"user","content":"Hi"}]' },
        { id: 'temperature', label: 'Temperature', type: 'number' },
        { id: 'maxTokens', label: 'Max tokens', type: 'number' },
      ],
      run: chat,
    },
    {
      id: 'embed',
      label: 'Create embedding',
      description: 'Embed text into a vector.',
      fields: [
        { id: 'input', label: 'Input', type: 'textarea', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'mistral-embed' },
      ],
      run: embed,
    },
    {
      id: 'moderate',
      label: 'Moderate text',
      description: 'Run text through Mistral moderation.',
      fields: [
        { id: 'input', label: 'Input', type: 'textarea', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'mistral-moderation-latest' },
      ],
      run: moderate,
    },
    {
      id: 'list_models',
      label: 'List models',
      description: 'List available Mistral models.',
      fields: [],
      run: listModels,
    },
  ],
};

registerForgeBlock(block);
export default block;
