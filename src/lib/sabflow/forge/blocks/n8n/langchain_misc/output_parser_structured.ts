/**
 * Forge block: LangChain Output Parser (Structured)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/output_parsers/OutputParserStructured/
 *
 * Strips code fences, parses JSON, then validates the parsed value against a
 * Zod-like inline schema spec. The schema is a flat object whose keys describe
 * the expected top-level field types — e.g. `{ "name": "string", "age": "number" }`.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

type FieldKind = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';

function parseSchemaSpec(raw: unknown): Record<string, FieldKind> {
  const s = asString(raw).trim();
  if (!s) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch (err) {
    throw new Error(`Output Parser (Structured): schema is not valid JSON — ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Output Parser (Structured): schema must be a JSON object of { field: type }');
  }
  const out: Record<string, FieldKind> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    const kind = asString(v).toLowerCase().trim() as FieldKind;
    if (!['string', 'number', 'boolean', 'object', 'array', 'any'].includes(kind)) {
      throw new Error(`Output Parser (Structured): unknown type "${kind}" for field "${k}"`);
    }
    out[k] = kind;
  }
  return out;
}

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

function kindOf(v: unknown): FieldKind {
  if (Array.isArray(v)) return 'array';
  if (v === null) return 'any';
  const t = typeof v;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'object') return t as FieldKind;
  return 'any';
}

function validate(value: unknown, schema: Record<string, FieldKind>): {
  missing: string[];
  mismatched: Array<{ field: string; expected: FieldKind; got: FieldKind }>;
} {
  const missing: string[] = [];
  const mismatched: Array<{ field: string; expected: FieldKind; got: FieldKind }> = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { missing: Object.keys(schema), mismatched };
  }
  const obj = value as Record<string, unknown>;
  for (const [k, expected] of Object.entries(schema)) {
    if (!(k in obj)) {
      missing.push(k);
      continue;
    }
    if (expected === 'any') continue;
    const got = kindOf(obj[k]);
    if (got !== expected) mismatched.push({ field: k, expected, got });
  }
  return { missing, mismatched };
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const rawText = asString(ctx.options.raw_text);
  if (!rawText) throw new Error('Output Parser (Structured): raw_text is required');
  const schema = parseSchemaSpec(ctx.options.schema);

  let parsed = tryParse(rawText);
  if (parsed === undefined) parsed = tryParse(stripFences(rawText));
  if (parsed === undefined) {
    throw new Error('Output Parser (Structured): could not parse raw_text as JSON');
  }

  const { missing, mismatched } = validate(parsed, schema);
  const valid = missing.length === 0 && mismatched.length === 0;
  return {
    outputs: { parsed, missing_fields: missing, type_mismatches: mismatched, valid },
    logs: [
      `Output Parser (Structured) → ${valid ? 'valid' : `invalid (missing: ${missing.length}, mismatched: ${mismatched.length})`}`,
    ],
  };
}

const block: ForgeBlock = {
  id: 'forge_output_parser_structured',
  name: 'LangChain Output Parser (Structured)',
  description: 'Parse LLM JSON output and validate it against a Zod-like inline schema spec.',
  iconName: 'LuShieldCheck',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'parse',
      label: 'Parse and validate',
      fields: [
        { id: 'raw_text', label: 'Raw LLM output', type: 'textarea', required: true },
        {
          id: 'schema',
          label: 'Schema spec (JSON: { field: "string|number|boolean|object|array|any" })',
          type: 'json',
          required: true,
          placeholder: '{\n  "name": "string",\n  "age": "number"\n}',
        },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
