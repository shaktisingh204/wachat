/**
 * Forge block: OpenRouter
 *
 * `https://openrouter.ai/api/v1` — unified gateway to dozens of LLM providers.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://openrouter.ai/api/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('OpenRouter: apiKey is required');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  };
  const referer = asString(ctx.options.referer);
  const title = asString(ctx.options.appTitle);
  if (referer) headers['HTTP-Referer'] = referer;
  if (title) headers['X-Title'] = title;
  return headers;
}

function parseJson(input: unknown, label: string): unknown {
  const s = asString(input).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`OpenRouter: ${label} must be valid JSON`);
  }
}

async function chatCompletion(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model);
  const prompt = asString(ctx.options.prompt);
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature);
  const messagesJson = parseJson(ctx.options.messagesJson, 'messagesJson');
  if (!model) throw new Error('OpenRouter: model is required');
  if (!prompt && !messagesJson) {
    throw new Error('OpenRouter: prompt or messagesJson is required');
  }
  const messages = Array.isArray(messagesJson)
    ? messagesJson
    : [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ];
  const body: Record<string, unknown> = { model, messages };
  if (typeof temperature === 'number') body.temperature = temperature;
  const res = await apiRequest({
    service: 'OpenRouter',
    method: 'POST',
    url: `${API}/chat/completions`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { completion: res.data }, logs: [`OpenRouter chat → ${model}`] };
}

async function listModels(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'OpenRouter',
    method: 'GET',
    url: `${API}/models`,
    headers: authHeaders(ctx),
  });
  return { outputs: { models: res.data }, logs: ['OpenRouter list models'] };
}

const block: ForgeBlock = {
  id: 'forge_openrouter',
  name: 'OpenRouter',
  description: 'Route chat completions to any model via the OpenRouter gateway.',
  iconName: 'LuBot',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat_completion',
      label: 'Chat completion',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model slug', type: 'text', required: true },
        { id: 'system', label: 'System', type: 'textarea' },
        { id: 'prompt', label: 'Prompt', type: 'textarea' },
        { id: 'messagesJson', label: 'Messages JSON (overrides)', type: 'json' },
        { id: 'temperature', label: 'Temperature', type: 'number' },
        { id: 'referer', label: 'HTTP-Referer', type: 'text' },
        { id: 'appTitle', label: 'X-Title', type: 'text' },
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
