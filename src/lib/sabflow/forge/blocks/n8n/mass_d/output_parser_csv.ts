/**
 * Forge block: CSV Output Parser
 *
 * Parses LLM/tool text output as CSV. Accepts an optional header row and
 * configurable delimiter. RFC-4180-ish quote handling: double-quoted fields
 * may contain commas/newlines, doubled quotes inside a field become one.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asBoolean, asString } from '../_shared/http';

function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delim) {
      cur.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('CSV Parser: text is required');
  const delim = asString(ctx.options.delimiter) || ',';
  const hasHeader = asBoolean(ctx.options.hasHeader);
  const rows = parseCsv(text.trim(), delim).filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ''));
  if (!hasHeader) {
    return { outputs: { rows, count: rows.length }, logs: [`CSV Parser → ${rows.length} row(s)`] };
  }
  const [header, ...body] = rows;
  const records = body.map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = r[idx] ?? '';
    });
    return obj;
  });
  return {
    outputs: { header, rows: records, count: records.length },
    logs: [`CSV Parser → header (${header.length} cols), ${records.length} row(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_output_parser_csv',
  name: 'Output Parser (CSV)',
  description: 'Parse text as CSV. Supports custom delimiter and optional header row.',
  iconName: 'LuTable',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'parse',
      label: 'Parse CSV',
      fields: [
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'delimiter', label: 'Delimiter', type: 'text', defaultValue: ',' },
        { id: 'hasHeader', label: 'First row is header', type: 'toggle', defaultValue: false },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
