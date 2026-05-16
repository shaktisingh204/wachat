/**
 * Forge block: LM Chat Anthropic
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/llms/LMChatAnthropic/LmChatAnthropic.node.ts
 *
 * In n8n, this node returns a LangChain ChatModel. SabFlow has no LangChain
 * runtime, so we expose a synchronous chat-completion caller that posts to
 * Anthropic's Messages API directly.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.anthropic.com/v1/messages';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Anthropic: apiKey is required');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Anthropic: prompt is required');
  const model = asString(ctx.options.model) || 'claude-3-5-sonnet-latest';
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;

  const payload: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature,
  };
  if (system) payload.system = system;

  const res = await apiRequest({
    service: 'Anthropic',
    method: 'POST',
    url: API,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    json: payload,
  });
  const body = res.data as { content?: Array<{ type?: string; text?: string }> };
  const text = (body?.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');
  return {
    outputs: { text, raw: res.data },
    logs: [`Anthropic chat → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_chat_anthropic',
  name: 'LM Chat Anthropic',
  description: 'Send a chat completion request to Anthropic Claude.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      description: 'Single-turn chat against Anthropic Messages API.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'claude-3-5-sonnet-latest' },
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
