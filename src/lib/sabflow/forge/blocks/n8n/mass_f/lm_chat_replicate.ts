/**
 * Forge block: LM Chat Replicate
 *
 * Runs a language model prediction via Replicate's predictions API
 * (`https://api.replicate.com/v1/predictions`). Uses the synchronous "wait"
 * preference header so the response includes the final output without polling.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.replicate.com/v1/predictions';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Replicate: apiKey is required');
  const version = asString(ctx.options.version);
  if (!version) throw new Error('Replicate: model version (hash) is required');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Replicate: prompt is required');
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;

  const input: Record<string, unknown> = { prompt, temperature, max_new_tokens: maxTokens };
  if (system) input.system_prompt = system;

  const res = await apiRequest({
    service: 'Replicate',
    method: 'POST',
    url: API,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Prefer: 'wait',
    },
    json: { version, input },
  });
  const body = res.data as { output?: unknown; status?: string };
  const out = Array.isArray(body?.output) ? body.output.join('') : asString(body?.output);
  return {
    outputs: { text: out, status: body?.status, raw: res.data },
    logs: [`Replicate prediction → ${body?.status ?? 'done'}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_chat_replicate',
  name: 'LM Chat Replicate',
  description: 'Run a language model prediction via Replicate.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Run prediction',
      description: 'Single-turn LM prediction via Replicate (sync wait).',
      fields: [
        { id: 'apiKey', label: 'API token', type: 'password', required: true },
        { id: 'version', label: 'Model version hash', type: 'text', required: true, placeholder: 'e.g. meta/meta-llama-3-8b-instruct version id' },
        { id: 'system', label: 'System prompt', type: 'textarea' },
        { id: 'prompt', label: 'User prompt', type: 'textarea', required: true },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
        { id: 'maxTokens', label: 'Max new tokens', type: 'number', defaultValue: 1024 },
      ],
      run: chat,
    },
  ],
};

registerForgeBlock(block);
export default block;
