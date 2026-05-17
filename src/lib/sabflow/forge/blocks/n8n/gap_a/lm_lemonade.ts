/**
 * Forge block: LM Lemonade (completions, non-chat)
 *
 * Lemonade SDK's OpenAI-compatible completions endpoint.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  const baseUrl = (asString(ctx.options.baseUrl) || 'http://localhost:8000').replace(/\/+$/, '');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Lemonade: prompt is required');
  const model = asString(ctx.options.model) || 'gpt-3.5-turbo-instruct';
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;
  const composed = system ? `${system}\n\n${prompt}` : prompt;

  const res = await apiRequest({
    service: 'Lemonade',
    method: 'POST',
    url: `${baseUrl}/api/v1/completions`,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    json: { model, prompt: composed, temperature, max_tokens: maxTokens },
  });
  const body = res.data as { choices?: Array<{ text?: string }> };
  return {
    outputs: { text: body?.choices?.[0]?.text ?? '', raw: res.data },
    logs: [`Lemonade completion → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_lemonade',
  name: 'LM Lemonade',
  description: 'Text completion via local Lemonade SDK (OpenAI-compatible /completions).',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Text completion',
      description: 'Single-turn completion against Lemonade /api/v1/completions.',
      fields: [
        { id: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'http://localhost:8000' },
        { id: 'apiKey', label: 'API key (optional)', type: 'password' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-3.5-turbo-instruct' },
        { id: 'system', label: 'System prompt (prepended to user prompt)', type: 'textarea' },
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
