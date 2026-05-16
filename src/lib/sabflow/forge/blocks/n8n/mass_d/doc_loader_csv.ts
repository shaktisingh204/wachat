/**
 * Forge block: CSV Document Loader
 *
 * Fetches a CSV (URL) or accepts inline text and emits one "document" per
 * row, LangChain-style. Reuses the same RFC-4180-ish parser as the CSV
 * output parser. Each document's `pageContent` is a `"key: value"` line per
 * column when a header is present, or the raw row when not.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asBoolean, asString } from '../_shared/http';

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
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

async function fetchText(url: string): Promise<string> {
  const res = await apiRequest({
    service: 'CSV Loader',
    method: 'GET',
    url,
    headers: { Accept: 'text/csv,text/plain,*/*' },
  });
  return res.text;
}

async function load(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  const inline = asString(ctx.options.text);
  if (!url && !inline) throw new Error('CSV Loader: provide either url or text');
  const delim = asString(ctx.options.delimiter) || ',';
  const hasHeader = asBoolean(ctx.options.hasHeader);
  const source = url || 'inline';
  const text = url ? await fetchText(url) : inline;
  const rows = parseCsv(text.trim(), delim);
  if (rows.length === 0) {
    return { outputs: { documents: [], count: 0 }, logs: [`CSV Loader → 0 row(s)`] };
  }
  let documents: { pageContent: string; metadata: Record<string, unknown> }[];
  if (hasHeader) {
    const [header, ...body] = rows;
    documents = body.map((r, idx) => {
      const obj: Record<string, string> = {};
      header.forEach((h, i) => {
        obj[h] = r[i] ?? '';
      });
      const pageContent = Object.entries(obj)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      return { pageContent, metadata: { source, row: idx + 1, ...obj } };
    });
  } else {
    documents = rows.map((r, idx) => ({
      pageContent: r.join(delim),
      metadata: { source, row: idx + 1 },
    }));
  }
  return {
    outputs: { documents, count: documents.length },
    logs: [`CSV Loader → ${documents.length} document(s) from ${source}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_doc_loader_csv',
  name: 'Document Loader (CSV)',
  description: 'Fetch (or accept inline) CSV and emit one Document per row.',
  iconName: 'LuTable2',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'load',
      label: 'Load CSV',
      fields: [
        { id: 'url', label: 'CSV URL (optional)', type: 'text' },
        { id: 'text', label: 'Inline CSV (optional)', type: 'textarea' },
        { id: 'delimiter', label: 'Delimiter', type: 'text', defaultValue: ',' },
        { id: 'hasHeader', label: 'First row is header', type: 'toggle', defaultValue: true },
      ],
      run: load,
    },
  ],
};

registerForgeBlock(block);
export default block;
