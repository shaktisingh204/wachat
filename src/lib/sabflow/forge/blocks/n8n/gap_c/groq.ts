/**
 * Forge block: Groq
 *
 * `https://api.groq.com/openai/v1` — fast LLM inference (OpenAI-compatible API).
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.groq.com/openai/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Groq: apiKey is required');
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

function parseJson(input: unknown, label: string): unknown {
  const s = asString(input).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`Groq: ${label} must be valid JSON`);
  }
}

async function chatCompletion(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'llama-3.1-70b-versatile';
  const prompt = asString(ctx.options.prompt);
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature);
  const maxTokens = asNumber(ctx.options.maxTokens);
  const messagesJson = parseJson(ctx.options.messagesJson, 'messagesJson');
  if (!prompt && !messagesJson) {
    throw new Error('Groq: prompt or messagesJson is required');
  }
  const messages = Array.isArray(messagesJson)
    ? messagesJson
    : [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ];
  const body: Record<string, unknown> = { model, messages, stream: false };
  if (typeof temperature === 'number') body.temperature = temperature;
  if (typeof maxTokens === 'number') body.max_tokens = maxTokens;
  const res = await apiRequest({
    service: 'Groq',
    method: 'POST',
    url: `${API}/chat/completions`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { completion: res.data }, logs: [`Groq chat → ${model}`] };
}

async function listModels(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Groq',
    method: 'GET',
    url: `${API}/models`,
    headers: authHeaders(ctx),
  });
  return { outputs: { models: res.data }, logs: ['Groq list models'] };
}

const block: ForgeBlock = {
  id: 'forge_groq',
  name: 'Groq',
  description: 'Run chat completions against Groq-hosted open models.',
  iconName: 'LuBot',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat_completion',
      label: 'Chat completion',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'llama-3.1-70b-versatile' },
        { id: 'system', label: 'System', type: 'textarea' },
        { id: 'prompt', label: 'Prompt', type: 'textarea' },
        { id: 'messagesJson', label: 'Messages JSON (overrides)', type: 'json' },
        { id: 'temperature', label: 'Temperature', type: 'number' },
        { id: 'maxTokens', label: 'Max tokens', type: 'number' },
      ],
      run: chatCompletion,
    },
    {
      id: 'list_models',
      label: 'List models',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
      ],
      run: listModels,
    },
  ],
};

registerForgeBlock(block);
export default block;
