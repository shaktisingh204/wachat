/**
 * Forge block: AI Transform (v1, legacy)
 *
 * Source: n8n-master/packages/nodes-base/nodes/AiTransform/AiTransform.node.ts
 *
 * The original n8n AI Transform node. It asks an LLM to generate JS code
 * from a plain-English instruction, then runs that code against the items.
 * The modern equivalent (covered in W7 as `forge_ai_transform`) splits the
 * "generate code" and "run code" steps; this v1 port keeps them coupled
 * so legacy workflows can be imported with their original prompt-driven
 * behaviour intact.
 *
 * Auth: OpenAI API key passed inline (n8n's original uses the platform's
 * AI service; we hit OpenAI's legacy `/v1/completions` endpoint directly
 * with the user's key to keep this block self-contained).
 *
 * For new flows prefer `forge_ai_transform` — kept here for migration
 * parity only.
 *
 * Operations covered:
 *   - transform_v1(input, instructions) → { code, result }
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const OPENAI_COMPLETIONS = 'https://api.openai.com/v1/completions';

function parseInput(raw: unknown): unknown[] {
  let value: unknown = raw;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return [];
    try {
      value = JSON.parse(t);
    } catch (err) {
      throw new Error(`AI Transform (v1): input is not valid JSON — ${(err as Error).message}`);
    }
  }
  if (!Array.isArray(value)) {
    throw new Error('AI Transform (v1): input must be an array of items');
  }
  return value;
}

function buildPrompt(instructions: string): string {
  // Distinct from W7's prompt template — keeps legacy "items + return items" framing.
  return [
    'You are an n8n AI Transform v1 helper. The user gives plain-English instructions.',
    'Write a JavaScript function body that mutates and returns the `items` array.',
    'The function receives a single argument `items` (array of plain objects).',
    'Return only the function body — no markdown fences, no explanations.',
    '',
    `Instructions:\n${instructions}`,
    '',
    'JavaScript:',
  ].join('\n');
}

function stripFences(code: string): string {
  return code
    .replace(/^```(?:javascript|js)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

async function transformV1(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('AI Transform (v1): apiKey is required');
  const instructions = asString(ctx.options.instructions);
  if (!instructions) throw new Error('AI Transform (v1): instructions is required');
  const items = parseInput(ctx.options.input);
  const model = asString(ctx.options.model) || 'gpt-3.5-turbo-instruct';

  const res = await apiRequest({
    service: 'AITransformV1',
    method: 'POST',
    url: OPENAI_COMPLETIONS,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      prompt: buildPrompt(instructions),
      temperature: 0,
      max_tokens: 800,
      stop: ['```'],
    },
  });

  const body = (res.data ?? {}) as { choices?: Array<{ text?: string }> };
  const raw = body.choices?.[0]?.text ?? '';
  const code = stripFences(raw);
  if (!code) throw new Error('AI Transform (v1): model returned empty code');

  let fn: (items: unknown[]) => unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    fn = new Function('items', `"use strict"; ${code}`) as typeof fn;
  } catch (err) {
    throw new Error(`AI Transform (v1): generated code failed to compile — ${(err as Error).message}`);
  }

  let result: unknown;
  try {
    result = fn(items);
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      result = await result;
    }
  } catch (err) {
    throw new Error(`AI Transform (v1): generated code threw — ${(err as Error).message}`);
  }

  return {
    outputs: { code, result },
    logs: [`AI Transform (v1) transform_v1 → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_ai_transform_v1',
  name: 'AI Transform (v1, legacy)',
  description: 'Legacy AI Transform — generates JS from a prompt and runs it on the items. Prefer `forge_ai_transform` for new flows.',
  iconName: 'LuWand',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'transform_v1',
      label: 'Transform (v1)',
      description: 'Generate JS code from instructions via OpenAI completions, then run it against `input`.',
      fields: [
        { id: 'apiKey', label: 'OpenAI API key', type: 'password', required: true },
        {
          id: 'model',
          label: 'Model',
          type: 'text',
          placeholder: 'gpt-3.5-turbo-instruct',
          helperText: 'Any OpenAI legacy completions model. Defaults to gpt-3.5-turbo-instruct.',
        },
        {
          id: 'instructions',
          label: 'Instructions',
          type: 'textarea',
          required: true,
          placeholder: "Merge 'firstname' and 'lastname' into a field 'details.name'",
        },
        {
          id: 'input',
          label: 'Input items',
          type: 'json',
          required: true,
          placeholder: '[{"firstname":"Ada","lastname":"Lovelace"}]',
          helperText: 'Array of plain objects exposed to the generated code as `items`.',
        },
      ],
      run: transformV1,
    },
  ],
};

registerForgeBlock(block);
export default block;
