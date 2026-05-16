/**
 * Forge block: LangChain Output Parser (Autofix)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/output_parsers/OutputParserAutofixing/
 *
 * Try to parse the raw text as JSON. If parsing fails, send the text +
 * target schema to an LLM with a "fix this JSON" prompt and re-parse.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function stripFences(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : s.trim();
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function parseSchema(raw: unknown): Record<string, unknown> | undefined {
  const s = asString(raw).trim();
  if (!s) return undefined;
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Output Parser (Autofix): schema is not valid JSON — ${(err as Error).message}`);
  }
  return undefined;
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
    'You repair malformed JSON. Read the text below and emit a single valid JSON object that matches the target schema. JSON only — no explanation, no markdown.';
  const res = await apiRequest({
    service: 'Output Parser (Autofix)',
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
  const parsed = tryParse(repaired) ?? tryParse(stripFences(repaired));
  if (parsed === undefined) throw new Error('Output Parser (Autofix): repair attempt did not return valid JSON');
  return parsed;
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const rawText = asString(ctx.options.raw_text);
  if (!rawText) throw new Error('Output Parser (Autofix): raw_text is required');
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Output Parser (Autofix): apiKey is required for repair fallback');
  const schema = parseSchema(ctx.options.schema);

  let parsed = tryParse(rawText) ?? tryParse(stripFences(rawText));
  let repaired = false;
  if (parsed === undefined) {
    const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model = asString(ctx.options.model) || 'gpt-4o-mini';
    parsed = await repairWithLlm(apiKey, baseUrl, model, rawText, schema);
    repaired = true;
  }

  return {
    outputs: { parsed, repaired },
    logs: [`Output Parser (Autofix) → ${repaired ? 'repaired via LLM' : 'parsed directly'}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_output_parser_autofix',
  name: 'LangChain Output Parser (Autofix)',
  description: 'Parse LLM JSON output; on failure, call an LLM to repair it and re-parse.',
  iconName: 'LuWrench',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'parse',
      label: 'Parse with auto-repair',
      fields: [
        { id: 'raw_text', label: 'Raw LLM output', type: 'textarea', required: true },
        { id: 'schema', label: 'Target schema (JSON object, optional)', type: 'json' },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Repair model', type: 'text', placeholder: 'gpt-4o-mini' },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
