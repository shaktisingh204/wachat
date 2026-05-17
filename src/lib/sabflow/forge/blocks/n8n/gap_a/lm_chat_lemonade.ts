/**
 * Forge block: LM Chat Lemonade
 *
 * Lemonade SDK exposes an OpenAI-compatible chat completions endpoint.
 * Default base URL: http://localhost:8000
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  const baseUrl = (asString(ctx.options.baseUrl) || 'http://localhost:8000').replace(/\/+$/, '');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Lemonade Chat: prompt is required');
  const model = asString(ctx.options.model) || 'gpt-3.5-turbo';
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;

  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const res = await apiRequest({
    service: 'Lemonade Chat',
    method: 'POST',
    url: `${baseUrl}/api/v1/chat/completions`,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    json: { model, messages, temperature, max_tokens: maxTokens },
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  return {
    outputs: { text: body?.choices?.[0]?.message?.content ?? '', raw: res.data },
    logs: [`Lemonade chat → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_chat_lemonade',
  name: 'LM Chat Lemonade',
  description: 'Chat completion via local Lemonade SDK (OpenAI-compatible).',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      description: 'Single-turn chat against Lemonade /api/v1/chat/completions.',
      fields: [
        { id: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'http://localhost:8000' },
        { id: 'apiKey', label: 'API key (optional)', type: 'password' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-3.5-turbo' },
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
