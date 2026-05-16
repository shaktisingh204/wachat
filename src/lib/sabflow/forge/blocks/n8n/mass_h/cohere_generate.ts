/**
 * Forge block: Cohere Generate (legacy)
 *
 * `/v1/generate` legacy completion + classify + tokenize.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.cohere.com/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Cohere: apiKey is required');
  return { Authorization: `Bearer ${apiKey}` };
}

async function generate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'command';
  const prompt = asString(ctx.options.prompt);
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 200;
  const temperature = asNumber(ctx.options.temperature);
  if (!prompt) throw new Error('Cohere: prompt is required');
  const body: Record<string, unknown> = { model, prompt, max_tokens: maxTokens };
  if (typeof temperature === 'number') body.temperature = temperature;
  const res = await apiRequest({
    service: 'Cohere',
    method: 'POST',
    url: `${API}/generate`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Cohere generate → ${model}`] };
}

async function classify(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'embed-english-v3.0';
  const inputsRaw = asString(ctx.options.inputs);
  const examplesRaw = asString(ctx.options.examples);
  if (!inputsRaw) throw new Error('Cohere: inputs is required');
  if (!examplesRaw) throw new Error('Cohere: examples is required');
  const inputs = inputsRaw.split('\n').map((s) => s.trim()).filter(Boolean);
  let examples: unknown;
  try {
    examples = JSON.parse(examplesRaw);
  } catch {
    throw new Error('Cohere: examples must be valid JSON');
  }
  const res = await apiRequest({
    service: 'Cohere',
    method: 'POST',
    url: `${API}/classify`,
    headers: authHeaders(ctx),
    json: { model, inputs, examples },
  });
  return { outputs: { classifications: res.data }, logs: ['Cohere classify'] };
}

async function tokenize(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  const model = asString(ctx.options.model) || 'command';
  if (!text) throw new Error('Cohere: text is required');
  const res = await apiRequest({
    service: 'Cohere',
    method: 'POST',
    url: `${API}/tokenize`,
    headers: authHeaders(ctx),
    json: { text, model },
  });
  return { outputs: { tokens: res.data }, logs: ['Cohere tokenize'] };
}

const block: ForgeBlock = {
  id: 'forge_cohere_generate',
  name: 'Cohere Generate',
  description: 'Call Cohere legacy /v1/generate, /v1/classify and /v1/tokenize.',
  iconName: 'LuBot',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'generate',
      label: 'Generate',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'command' },
        { id: 'prompt', label: 'Prompt', type: 'textarea', required: true },
        { id: 'maxTokens', label: 'Max tokens', type: 'number', defaultValue: 200 },
        { id: 'temperature', label: 'Temperature', type: 'number' },
      ],
      run: generate,
    },
    {
      id: 'classify',
      label: 'Classify',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'embed-english-v3.0' },
        { id: 'inputs', label: 'Inputs (one per line)', type: 'textarea', required: true },
        { id: 'examples', label: 'Examples (JSON array)', type: 'json', required: true },
      ],
      run: classify,
    },
    {
      id: 'tokenize',
      label: 'Tokenize',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'command' },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
      ],
      run: tokenize,
    },
  ],
};

registerForgeBlock(block);
export default block;
