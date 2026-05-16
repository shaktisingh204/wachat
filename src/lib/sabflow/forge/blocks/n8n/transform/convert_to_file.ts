/**
 * Forge block: Convert to File
 *
 * Source: n8n-master/packages/nodes-base/nodes/Files/ConvertToFile/ConvertToFile.node.ts
 *
 * Produces a base64-encoded "file" payload that downstream blocks can hand
 * off to SabFiles or attach to outbound messages. We expose three flavours:
 *   - to_text_file → raw text → base64(text)
 *   - to_json_file → pretty-printed JSON
 *   - to_csv_file  → JSON array of objects → CSV
 *
 * Limitations:
 *   - n8n's spreadsheet/xlsx mode is not ported here (would need a heavy
 *     dependency); SabFiles already handles uploads, this block just makes
 *     a transient representation.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';
import { parseJson, parseJsonArray } from '../_shared/json';

function toFile(content: string, mime: string, name: string) {
  const buf = Buffer.from(content, 'utf8');
  return {
    fileName: name,
    mimeType: mime,
    base64: buf.toString('base64'),
    bytes: buf.length,
  };
}

async function toTextFile(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('ConvertToFile: text is required');
  const fileName = asString(ctx.options.fileName) || 'file.txt';
  const file = toFile(text, 'text/plain', fileName);
  return { outputs: { file }, logs: [`ConvertToFile text → ${file.bytes}B as ${fileName}`] };
}

async function toJsonFile(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = parseJson(ctx.options.data, 'data');
  const pretty = JSON.stringify(data, null, 2);
  const fileName = asString(ctx.options.fileName) || 'file.json';
  const file = toFile(pretty, 'application/json', fileName);
  return { outputs: { file }, logs: [`ConvertToFile json → ${file.bytes}B as ${fileName}`] };
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function toCsvFile(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const items = parseJsonArray<Record<string, unknown>>(ctx.options.items, 'items');
  if (items.length === 0) {
    throw new Error('ConvertToFile: items is empty — nothing to write');
  }
  // Header = union of keys across all rows, preserving first-seen order.
  const headers: string[] = [];
  for (const row of items) {
    if (!row || typeof row !== 'object') continue;
    for (const k of Object.keys(row)) {
      if (!headers.includes(k)) headers.push(k);
    }
  }
  const lines: string[] = [headers.map(csvEscape).join(',')];
  for (const row of items) {
    const safe = (row ?? {}) as Record<string, unknown>;
    lines.push(headers.map((h) => csvEscape(safe[h])).join(','));
  }
  const csv = lines.join('\n');
  const fileName = asString(ctx.options.fileName) || 'file.csv';
  const file = toFile(csv, 'text/csv', fileName);
  return {
    outputs: { file, rows: items.length, columns: headers },
    logs: [`ConvertToFile csv → ${file.bytes}B (${items.length} rows × ${headers.length} cols)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_convert_to_file',
  name: 'Convert to File',
  description: 'Convert text, JSON, or a JSON array into a base64 file payload.',
  iconName: 'LuFileOutput',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'to_text_file',
      label: 'To text file',
      description: 'Wrap a UTF-8 text into a base64 .txt file.',
      fields: [
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'fileName', label: 'File name', type: 'text', placeholder: 'file.txt' },
      ],
      run: toTextFile,
    },
    {
      id: 'to_json_file',
      label: 'To JSON file',
      description: 'Pretty-print a JSON value into a base64 .json file.',
      fields: [
        { id: 'data', label: 'Data (JSON)', type: 'json', required: true },
        { id: 'fileName', label: 'File name', type: 'text', placeholder: 'file.json' },
      ],
      run: toJsonFile,
    },
    {
      id: 'to_csv_file',
      label: 'To CSV file',
      description: 'Convert a JSON array of objects into a base64 .csv file.',
      fields: [
        {
          id: 'items',
          label: 'Items (JSON array)',
          type: 'json',
          required: true,
          placeholder: '[{"name":"Ada","age":36}]',
        },
        { id: 'fileName', label: 'File name', type: 'text', placeholder: 'file.csv' },
      ],
      run: toCsvFile,
    },
  ],
};

registerForgeBlock(block);
export default block;
