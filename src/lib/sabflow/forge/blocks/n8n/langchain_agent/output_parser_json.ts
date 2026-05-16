/**
 * Forge block: LangChain Output Parser (JSON)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/output_parsers/OutputParserStructured/OutputParserStructured.node.ts
 *
 * Cleans up LLM output: strips Markdown code fences, parses as JSON, then
 * shallow-validates that the parsed value has the keys declared in `schema`.
 * If the raw text is already a JSON object, no LLM call is made. If parsing
 * fails and `apiKey` is supplied, we ask the LLM to repair the output once.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function parseSchema(raw: unknown): Record<string, unknown> | undefined {
  const s = asString(raw).trim();
  if (!s) return undefined;
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (err) {
    throw new Error(`Output Parser: schema is not valid JSON — ${(err as Error).message}`);
  }
  return undefined;
}

function stripFences(s: string): string {
  // Extract the first ```json…``` block if present.
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  return s.trim();
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function validateShape(value: unknown, schema: Record<string, unknown>): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['parsed value is not a JSON object'];
  }
  const obj = value as Record<string, unknown>;
  const missing: string[] = [];
  for (const key of Object.keys(schema)) {
    if (!(key in obj)) missing.push(key);
  }
  return missing;
}

async function repairWithLlm(
  apiKey: string,
  baseUrl: string,
  model: string,
  rawText: string,
  schema: Record<string, unknown> | undefined,
): Promise<unknown> {
  const schemaBlurb = schema ? `Target schema:\n${JSON.stringify(schema, null, 2)}\n\n` : '';
  const system =
    'You repair malformed JSON. Read the text below and emit a single valid JSON object that best represents it. JSON only.';
  const res = await apiRequest({
    service: 'Output Parser',
    method: 'POST',
    url: `${baseUrl}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `${schemaBlurb}Raw text:\n${rawText}` },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    },
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  const repaired = body?.choices?.[0]?.message?.content ?? '';
  const parsed = tryParse(repaired);
  if (parsed === undefined) throw new Error('Output Parser: repair attempt did not return valid JSON');
  return parsed;
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const rawText = asString(ctx.options.raw_text);
  if (!rawText) throw new Error('Output Parser: raw_text is required');
  const schema = parseSchema(ctx.options.schema);

  // Pass 1 — direct parse.
  let parsed = tryParse(rawText);
  // Pass 2 — strip fences.
  if (parsed === undefined) parsed = tryParse(stripFences(rawText));
  // Pass 3 — last-chance LLM repair (only if apiKey supplied).
  if (parsed === undefined) {
    const apiKey = asString(ctx.options.apiKey);
    if (apiKey) {
      const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const model = asString(ctx.options.model) || 'gpt-4o-mini';
      parsed = await repairWithLlm(apiKey, baseUrl, model, rawText, schema);
    } else {
      throw new Error('Output Parser: could not parse raw_text as JSON (supply apiKey to enable LLM repair)');
    }
  }

  const missing = schema ? validateShape(parsed, schema) : [];
  return {
    outputs: {
      parsed,
      missing_fields: missing,
      valid: missing.length === 0,
    },
    logs: [
      `Output Parser → parsed (${missing.length === 0 ? 'valid' : `missing: ${missing.join(', ')}`})`,
    ],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_output_parser_json',
  name: 'LangChain Output Parser (JSON)',
  description: 'Strip code fences, parse JSON, and shallow-validate against a schema. Optional LLM repair.',
  iconName: 'LuBraces',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Parse JSON output',
      fields: [
        { id: 'raw_text', label: 'Raw LLM output', type: 'textarea', required: true },
        { id: 'schema', label: 'Expected schema (JSON object — shallow keys)', type: 'json' },
        { id: 'apiKey', label: 'API key (for repair fallback, optional)', type: 'password' },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Repair model', type: 'text', placeholder: 'gpt-4o-mini' },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
