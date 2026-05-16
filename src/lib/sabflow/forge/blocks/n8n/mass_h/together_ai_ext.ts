/**
 * Forge block: Together AI Chat (extended)
 *
 * `https://api.together.xyz/v1/chat/completions` — OpenAI-compatible chat.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.together.xyz/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Together AI: apiKey is required');
  return { Authorization: `Bearer ${apiKey}` };
}

function parseOptionalJson(input: unknown, label: string): unknown {
  const s = asString(input).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`Together AI: ${label} must be valid JSON`);
  }
}

async function chatCompletion(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'meta-llama/Llama-3-8b-chat-hf';
  const prompt = asString(ctx.options.prompt);
  const messagesJson = parseOptionalJson(ctx.options.messagesJson, 'messagesJson');
  const maxTokens = asNumber(ctx.options.maxTokens);
  const temperature = asNumber(ctx.options.temperature);
  if (!prompt && !messagesJson) {
    throw new Error('Together AI: prompt or messagesJson is required');
  }
  const messages = Array.isArray(messagesJson)
    ? messagesJson
    : [{ role: 'user', content: prompt }];
  const body: Record<string, unknown> = { model, messages, stream: false };
  if (typeof maxTokens === 'number') body.max_tokens = maxTokens;
  if (typeof temperature === 'number') body.temperature = temperature;
  const res = await apiRequest({
    service: 'Together AI',
    method: 'POST',
    url: `${API}/chat/completions`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { completion: res.data }, logs: [`Together AI chat → ${model}`] };
}

async function completion(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'meta-llama/Llama-3-8b-hf';
  const prompt = asString(ctx.options.prompt);
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 256;
  if (!prompt) throw new Error('Together AI: prompt is required');
  const res = await apiRequest({
    service: 'Together AI',
    method: 'POST',
    url: `${API}/completions`,
    headers: authHeaders(ctx),
    json: { model, prompt, max_tokens: maxTokens, stream: false },
  });
  return { outputs: { completion: res.data }, logs: [`Together AI completion → ${model}`] };
}

async function listModels(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Together AI',
    method: 'GET',
    url: `${API}/models`,
    headers: authHeaders(ctx),
  });
  return { outputs: { models: res.data }, logs: ['Together AI list models'] };
}

const block: ForgeBlock = {
  id: 'forge_together_ai_ext',
  name: 'Together AI (extended)',
  description: 'OpenAI-compatible chat and text completion + model listing via Together AI.',
  iconName: 'LuBot',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat_completion',
      label: 'Chat completion',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'meta-llama/Llama-3-8b-chat-hf' },
        { id: 'prompt', label: 'Prompt', type: 'textarea' },
        { id: 'messagesJson', label: 'Messages JSON (overrides prompt)', type: 'json' },
        { id: 'maxTokens', label: 'Max tokens', type: 'number' },
        { id: 'temperature', label: 'Temperature', type: 'number' },
      ],
      run: chatCompletion,
    },
    {
      id: 'completion',
      label: 'Text completion',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'meta-llama/Llama-3-8b-hf' },
        { id: 'prompt', label: 'Prompt', type: 'textarea', required: true },
        { id: 'maxTokens', label: 'Max tokens', type: 'number', defaultValue: 256 },
      ],
      run: completion,
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
