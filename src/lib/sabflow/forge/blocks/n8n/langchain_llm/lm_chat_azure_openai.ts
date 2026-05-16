/**
 * Forge block: LM Chat Azure OpenAI
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/llms/LmChatAzureOpenAi/LmChatAzureOpenAi.node.ts
 *
 * Posts to `<endpoint>/openai/deployments/<deployment>/chat/completions`.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Azure OpenAI: apiKey is required');
  const endpoint = asString(ctx.options.endpoint);
  if (!endpoint) throw new Error('Azure OpenAI: endpoint is required');
  const deployment = asString(ctx.options.deployment);
  if (!deployment) throw new Error('Azure OpenAI: deployment is required');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Azure OpenAI: prompt is required');
  const apiVersion = asString(ctx.options.apiVersion) || '2024-02-15-preview';
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;

  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(
    deployment,
  )}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

  const res = await apiRequest({
    service: 'Azure OpenAI',
    method: 'POST',
    url,
    headers: { 'api-key': apiKey },
    json: { messages, temperature, max_tokens: maxTokens },
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  return {
    outputs: { text: body?.choices?.[0]?.message?.content ?? '', raw: res.data },
    logs: [`Azure OpenAI chat → ${deployment}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_chat_azure_openai',
  name: 'LM Chat Azure OpenAI',
  description: 'Send a chat completion request to an Azure OpenAI deployment.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'endpoint', label: 'Endpoint', type: 'text', required: true, placeholder: 'https://my-resource.openai.azure.com' },
        { id: 'deployment', label: 'Deployment name', type: 'text', required: true },
        { id: 'apiVersion', label: 'API version', type: 'text', placeholder: '2024-02-15-preview' },
        { id: 'model', label: 'Model (informational)', type: 'text', placeholder: 'gpt-4o-mini' },
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
