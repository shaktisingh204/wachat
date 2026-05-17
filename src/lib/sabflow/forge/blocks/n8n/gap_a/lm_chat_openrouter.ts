/**
 * Forge block: LM Chat OpenRouter
 *
 * POST https://openrouter.ai/api/v1/chat/completions (OpenAI-compatible)
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://openrouter.ai/api/v1/chat/completions';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('OpenRouter: apiKey is required');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('OpenRouter: prompt is required');
  const model = asString(ctx.options.model) || 'openai/gpt-4o-mini';
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;

  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const res = await apiRequest({
    service: 'OpenRouter',
    method: 'POST',
    url: API,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://sabnode.local',
      'X-Title': 'SabFlow',
    },
    json: { model, messages, temperature, max_tokens: maxTokens },
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  return {
    outputs: { text: body?.choices?.[0]?.message?.content ?? '', raw: res.data },
    logs: [`OpenRouter chat → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_chat_openrouter',
  name: 'LM Chat OpenRouter',
  description: 'Chat completion via OpenRouter (multi-provider gateway).',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      description: 'Single-turn chat against OpenRouter /api/v1/chat/completions.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model (provider/model)', type: 'text', placeholder: 'openai/gpt-4o-mini' },
        { id: 'system', label: 'System prompt', type: 'textarea' },
        { id: 'prompt', label: 'User prompt', type: 'textarea', required: true },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
        { id: 'maxTokens', label: 'Max tokens', type: 'number', defaultValue: 1024 },
      ],
      run: chat,
    },
  ],
};

registerForgeBlock(block);
export default block;
