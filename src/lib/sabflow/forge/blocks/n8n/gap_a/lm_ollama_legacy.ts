/**
 * Forge block: LM Ollama Legacy (/api/generate, single-prompt)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/llms/LMOllama
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  const baseUrl = (asString(ctx.options.baseUrl) || 'http://localhost:11434').replace(/\/+$/, '');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Ollama Legacy: prompt is required');
  const model = asString(ctx.options.model) || 'llama3';
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;

  const body: Record<string, unknown> = {
    model,
    prompt,
    stream: false,
    options: { temperature, num_predict: maxTokens },
  };
  if (system) body.system = system;

  const res = await apiRequest({
    service: 'Ollama Legacy',
    method: 'POST',
    url: `${baseUrl}/api/generate`,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    json: body,
  });
  const data = res.data as { response?: string };
  return {
    outputs: { text: data?.response ?? '', raw: res.data },
    logs: [`Ollama legacy generate → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_ollama_legacy',
  name: 'LM Ollama (legacy)',
  description: 'Single-prompt generation against an Ollama server (/api/generate).',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Generate',
      description: 'Single-prompt generation via Ollama /api/generate.',
      fields: [
        { id: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'http://localhost:11434' },
        { id: 'apiKey', label: 'API key (optional)', type: 'password' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'llama3' },
        { id: 'system', label: 'System prompt', type: 'textarea' },
        { id: 'prompt', label: 'User prompt', type: 'textarea', required: true },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
        { id: 'maxTokens', label: 'Max tokens (num_predict)', type: 'number', defaultValue: 1024 },
      ],
      run: chat,
    },
  ],
};

registerForgeBlock(block);
export default block;
