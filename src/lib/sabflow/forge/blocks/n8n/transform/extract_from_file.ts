/**
 * Forge block: Extract from File
 *
 * Source: n8n-master/packages/nodes-base/nodes/Files/ExtractFromFile/ExtractFromFile.node.ts
 *
 * Inverse of ConvertToFile — parse a base64 payload into a usable structure:
 *   - from_text → base64(text) → string
 *   - from_json → base64(json) → parsed JS value
 *   - from_csv  → base64(csv)  → JSON array of objects (first row = headers)
 *
 * Limitations:
 *   - PDF / docx / xlsx parsing is not ported (heavy deps). For SabFiles
 *     attachments those should be unwrapped upstream.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

function decodeBase64(b64: string, label: string): string {
  if (!b64) throw new Error(`${label}: base64 is required`);
  try {
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch (err) {
    throw new Error(`${label}: invalid base64 — ${(err as Error).message}`);
  }
}

async function fromText(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = decodeBase64(asString(ctx.options.base64), 'ExtractFromFile.text');
  return {
    outputs: { text, bytes: text.length },
    logs: [`ExtractFromFile text → ${text.length}B`],
  };
}

async function fromJson(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = decodeBase64(asString(ctx.options.base64), 'ExtractFromFile.json');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`ExtractFromFile.json: not valid JSON — ${(err as Error).message}`);
  }
  return {
    outputs: { data },
    logs: ['ExtractFromFile json → parsed'],
  };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function fromCsv(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = decodeBase64(asString(ctx.options.base64), 'ExtractFromFile.csv');
  // Normalise line endings & strip a trailing newline.
  const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n+$/, '');
  if (!normalised) {
    return { outputs: { items: [], count: 0 }, logs: ['ExtractFromFile csv → empty'] };
  }
  const lines = normalised.split('\n');
  const headers = parseCsvLine(lines[0]);
  const items: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cells[j] ?? '';
    }
    items.push(row);
  }
  return {
    outputs: { items, count: items.length, columns: headers },
    logs: [`ExtractFromFile csv → ${items.length} rows × ${headers.length} cols`],
  };
}

const block: ForgeBlock = {
  id: 'forge_extract_from_file',
  name: 'Extract from File',
  description: 'Decode a base64 file payload as text, JSON, or CSV.',
  iconName: 'LuFileInput',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'from_text',
      label: 'From text file',
      description: 'Decode a base64 text file into a UTF-8 string.',
      fields: [
        { id: 'base64', label: 'Base64 payload', type: 'textarea', required: true },
      ],
      run: fromText,
    },
    {
      id: 'from_json',
      label: 'From JSON file',
      description: 'Decode a base64 JSON file and parse it.',
      fields: [
        { id: 'base64', label: 'Base64 payload', type: 'textarea', required: true },
      ],
      run: fromJson,
    },
    {
      id: 'from_csv',
      label: 'From CSV file',
      description: 'Decode a base64 CSV file and emit a JSON array (header row required).',
      fields: [
        { id: 'base64', label: 'Base64 payload', type: 'textarea', required: true },
      ],
      run: fromCsv,
    },
  ],
};

registerForgeBlock(block);
export default block;
