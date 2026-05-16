/**
 * Forge block: LM Chat Alibaba Cloud (DashScope)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/llms/LmChatAlibabaCloud/LmChatAlibabaCloud.node.ts
 *
 * Alibaba DashScope exposes an OpenAI-compatible chat-completions endpoint.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Alibaba DashScope: apiKey is required');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Alibaba DashScope: prompt is required');
  const model = asString(ctx.options.model) || 'qwen-plus';
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;

  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const res = await apiRequest({
    service: 'Alibaba DashScope',
    method: 'POST',
    url: API,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: { model, messages, temperature, max_tokens: maxTokens },
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  return {
    outputs: { text: body?.choices?.[0]?.message?.content ?? '', raw: res.data },
    logs: [`Alibaba chat → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_chat_alibaba',
  name: 'LM Chat Alibaba Cloud',
  description: 'Send a chat completion request to Alibaba DashScope (Qwen).',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'qwen-plus' },
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
