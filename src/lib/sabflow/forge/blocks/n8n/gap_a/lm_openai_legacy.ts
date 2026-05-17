/**
 * Forge block: LM OpenAI Legacy (/v1/completions, non-chat)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/llms/LMOpenAi
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.openai.com/v1/completions';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('OpenAI Legacy: apiKey is required');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('OpenAI Legacy: prompt is required');
  const model = asString(ctx.options.model) || 'gpt-3.5-turbo-instruct';
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;
  const composed = system ? `${system}\n\n${prompt}` : prompt;

  const res = await apiRequest({
    service: 'OpenAI Legacy',
    method: 'POST',
    url: API,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: { model, prompt: composed, temperature, max_tokens: maxTokens },
  });
  const body = res.data as { choices?: Array<{ text?: string }> };
  return {
    outputs: { text: body?.choices?.[0]?.text ?? '', raw: res.data },
    logs: [`OpenAI legacy completion → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_openai_legacy',
  name: 'LM OpenAI (legacy)',
  description: 'Text completion against OpenAI /v1/completions (legacy instruct models).',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Text completion',
      description: 'Single-turn completion against the legacy /v1/completions endpoint.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-3.5-turbo-instruct' },
        { id: 'system', label: 'System prompt (prepended)', type: 'textarea' },
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
