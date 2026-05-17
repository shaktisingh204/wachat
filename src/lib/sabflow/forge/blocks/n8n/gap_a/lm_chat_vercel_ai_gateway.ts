/**
 * Forge block: LM Chat Vercel AI Gateway
 *
 * The Vercel AI Gateway exposes an OpenAI-compatible chat-completions endpoint
 * at https://gateway.ai.vercel.com/v1/chat/completions and routes by the
 * `model` field, which takes a `provider/model` slug (e.g. `anthropic/claude-3-5-sonnet`).
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://gateway.ai.vercel.com/v1/chat/completions';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Vercel AI Gateway: apiKey is required');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Vercel AI Gateway: prompt is required');
  const model = asString(ctx.options.model);
  if (!model) throw new Error('Vercel AI Gateway: model (provider/model slug) is required');
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;

  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const res = await apiRequest({
    service: 'Vercel AI Gateway',
    method: 'POST',
    url: API,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: { model, messages, temperature, max_tokens: maxTokens },
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  return {
    outputs: { text: body?.choices?.[0]?.message?.content ?? '', raw: res.data },
    logs: [`Vercel AI Gateway chat → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_chat_vercel_ai_gateway',
  name: 'LM Chat Vercel AI Gateway',
  description: 'Chat completion via Vercel AI Gateway (provider/model routing).',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      description: 'Single-turn chat routed through the Vercel AI Gateway.',
      fields: [
        { id: 'apiKey', label: 'AI Gateway key', type: 'password', required: true },
        {
          id: 'model',
          label: 'Model (provider/model)',
          type: 'text',
          required: true,
          placeholder: 'anthropic/claude-3-5-sonnet',
        },
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
