/**
 * Forge block: LM Chat Ollama
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/llms/LMChatOllama/LmChatOllama.node.ts
 *
 * Posts to `<baseUrl>/api/chat`. Ollama itself has no auth, but the proxy in
 * front of it might — we accept an optional bearer token / header value.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const baseUrl = asString(ctx.options.baseUrl) || 'http://localhost:11434';
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Ollama: prompt is required');
  const model = asString(ctx.options.model) || 'llama3.1';
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;
  const apiKey = asString(ctx.options.apiKey);

  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await apiRequest({
    service: 'Ollama',
    method: 'POST',
    url: `${baseUrl.replace(/\/$/, '')}/api/chat`,
    headers,
    json: {
      model,
      messages,
      stream: false,
      options: { temperature, num_predict: maxTokens },
    },
  });
  const body = res.data as { message?: { content?: string } };
  return {
    outputs: { text: body?.message?.content ?? '', raw: res.data },
    logs: [`Ollama chat → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_chat_ollama',
  name: 'LM Chat Ollama',
  description: 'Send a chat completion request to an Ollama server.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      description: 'Single-turn chat against Ollama /api/chat.',
      fields: [
        { id: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'http://localhost:11434' },
        { id: 'apiKey', label: 'API key (optional)', type: 'password' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'llama3.1' },
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
