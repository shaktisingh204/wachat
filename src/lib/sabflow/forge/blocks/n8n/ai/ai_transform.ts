/**
 * Forge block: AI Transform
 *
 * Source: n8n-master/packages/nodes-base/nodes/AiTransform/AiTransform.node.ts
 * Credential type: 'openai' (expects { apiKey }).
 *
 * Wraps an OpenAI chat completion to transform an input value by a
 * natural-language instruction — the same idea n8n's AI Transform node uses
 * (LLM-generated transformation code), but materialised as a single direct
 * chat call so we don't need a sandboxed code runner. Returns the model's
 * raw text in `output`.
 *
 * Operations:
 *   - transform({ input, instructions, model })
 *
 * Deferred:
 *   - generated-code mode (would need a JS sandbox)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

function bearer(ctx: ForgeActionContext): string {
  const cred = requireCredential('AI Transform', ctx.credential);
  const key = cred.apiKey ?? cred.accessToken;
  if (!key) throw new Error('AI Transform: credential is missing `apiKey`');
  return `Bearer ${key}`;
}

async function transform(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const input = asString(ctx.options.input);
  const instructions = asString(ctx.options.instructions);
  const model = asString(ctx.options.model) || 'gpt-4o-mini';
  if (!instructions) throw new Error('AI Transform: instructions are required');

  const messages = [
    {
      role: 'system',
      content:
        'You are a data transformation engine. Apply the user instructions to the input. Return only the transformed value with no preamble.',
    },
    {
      role: 'user',
      content: `Instructions:\n${instructions}\n\nInput:\n${input}`,
    },
  ];

  const res = await apiRequest({
    service: 'AI Transform',
    method: 'POST',
    url: ENDPOINT,
    headers: { Authorization: bearer(ctx) },
    json: { model, messages, temperature: 0 },
  });
  const body = res.data as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const output = body?.choices?.[0]?.message?.content ?? '';
  return {
    outputs: { output, raw: res.data },
    logs: [`AI Transform → ${model} (${output.length} chars)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_ai_transform',
  name: 'AI Transform',
  description: 'Transform input data using a natural-language instruction (OpenAI).',
  iconName: 'LuWand',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'openai' },
  actions: [
    {
      id: 'transform',
      label: 'Transform',
      description: 'Run the input through the model with the given instructions.',
      fields: [
        { id: 'input', label: 'Input', type: 'textarea', required: true },
        { id: 'instructions', label: 'Instructions', type: 'textarea', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
      ],
      run: transform,
    },
  ],
};

registerForgeBlock(block);
export default block;
