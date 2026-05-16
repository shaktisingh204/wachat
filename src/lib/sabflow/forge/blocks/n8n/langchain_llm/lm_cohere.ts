/**
 * Forge block: LM Cohere
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/llms/LMCohere/LmCohere.node.ts
 *
 * Calls Cohere's v2 chat endpoint.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.cohere.com/v2/chat';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Cohere: apiKey is required');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Cohere: prompt is required');
  const model = asString(ctx.options.model) || 'command-r-plus';
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;

  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const res = await apiRequest({
    service: 'Cohere',
    method: 'POST',
    url: API,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: { model, messages, temperature, max_tokens: maxTokens },
  });
  const body = res.data as {
    message?: { content?: Array<{ type?: string; text?: string }> };
  };
  const text = (body?.message?.content ?? [])
    .filter((c) => c.type === 'text' || c.type === undefined)
    .map((c) => c.text ?? '')
    .join('');
  return {
    outputs: { text, raw: res.data },
    logs: [`Cohere chat → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_cohere',
  name: 'LM Cohere',
  description: 'Send a chat completion request to Cohere.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'command-r-plus' },
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
