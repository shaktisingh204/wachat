/**
 * Forge block: Spreadsheet File
 *
 * Source: n8n-master/packages/nodes-base/nodes/SpreadsheetFile/SpreadsheetFile.node.ts
 *
 * Parse CSV/TSV/XLSX from either a base64 payload or an HTTPS URL, and write
 * JSON rows back to CSV. XLSX support requires the `xlsx` npm package — when
 * absent the action throws an install hint.
 *
 * NOTE: This operates entirely on in-memory bytes; no disk IO. For inputs
 * stored in SabFiles, share-link the file then pass the share URL.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

type Row = Record<string, string>;

function parseDelimited(text: string, delimiter: string): Row[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQ = false;
        } else {
          cur += c;
        }
      } else {
        if (c === '"') inQ = true;
        else if (c === delimiter) {
          out.push(cur);
          cur = '';
        } else cur += c;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = split(lines[0]);
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]);
    const row: Row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cells[j] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

function rowsToCsv(rows: unknown[]): string {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const headerSet = new Set<string>();
  for (const r of rows) {
    if (r && typeof r === 'object') {
      for (const k of Object.keys(r as Record<string, unknown>)) headerSet.add(k);
    }
  }
  const headers = Array.from(headerSet);
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    const rec = (r ?? {}) as Record<string, unknown>;
    lines.push(headers.map((h) => escape(rec[h])).join(','));
  }
  return lines.join('\n');
}

async function loadBytes(ctx: ForgeActionContext): Promise<{ buf: Buffer; source: string }> {
  const base64 = asString(ctx.options.input_base64);
  if (base64) return { buf: Buffer.from(base64, 'base64'), source: 'base64' };
  const url = asString(ctx.options.url);
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SpreadsheetFile: fetch ${url} failed (${res.status})`);
    return { buf: Buffer.from(new Uint8Array(await res.arrayBuffer())), source: url };
  }
  throw new Error('SpreadsheetFile: provide input_base64 or url');
}

async function readCsv(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { buf, source } = await loadBytes(ctx);
  const format = (asString(ctx.options.format) || 'csv').toLowerCase();
  let rows: Row[] = [];
  if (format === 'csv') {
    rows = parseDelimited(buf.toString('utf8'), ',');
  } else if (format === 'tsv') {
    rows = parseDelimited(buf.toString('utf8'), '\t');
  } else if (format === 'xlsx') {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    // exceljs declares its own Buffer type that predates Node's generic
    // Buffer<ArrayBuffer>; the runtime value is a plain Buffer either way.
    await workbook.xlsx.load(
      Buffer.from(buf) as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
    const requestedSheet = asString(ctx.options.sheet);
    const worksheet = requestedSheet
      ? workbook.getWorksheet(requestedSheet)
      : workbook.worksheets[0];
    if (!worksheet) throw new Error(`SpreadsheetFile: sheet "${requestedSheet || '(first)'}" not found`);
    const headers: string[] = [];
    worksheet.eachRow((row, rowNumber) => {
      const vals = (row.values as any[]).slice(1);
      if (rowNumber === 1) {
        headers.push(...vals.map(v => v == null ? '' : String(v)));
      } else {
        const obj: Row = {};
        headers.forEach((h, i) => { obj[h] = vals[i] == null ? '' : String(vals[i]); });
        rows.push(obj);
      }
    });
  } else {
    throw new Error(`SpreadsheetFile: unsupported format "${format}"`);
  }
  return {
    outputs: { rows, count: rows.length },
    logs: [`SpreadsheetFile read_csv (${format}) → ${rows.length} rows from ${source}`],
  };
}

async function toCsv(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const raw = ctx.options.rows;
  let rows: unknown[] = [];
  if (Array.isArray(raw)) rows = raw;
  else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('not an array');
      rows = parsed;
    } catch (e) {
      throw new Error(`SpreadsheetFile: rows must be a JSON array (${(e as Error).message})`);
    }
  } else {
    throw new Error('SpreadsheetFile: rows is required (JSON array)');
  }
  const csv = rowsToCsv(rows);
  const base64 = Buffer.from(csv, 'utf8').toString('base64');
  return {
    outputs: { csv, base64, count: rows.length },
    logs: [`SpreadsheetFile to_csv → ${rows.length} rows / ${csv.length}B`],
  };
}

const FORMAT_OPTIONS = [
  { label: 'CSV', value: 'csv' },
  { label: 'TSV', value: 'tsv' },
  { label: 'XLSX', value: 'xlsx' },
];

const block: ForgeBlock = {
  id: 'forge_spreadsheet_file',
  name: 'Spreadsheet File',
  description: 'Parse CSV/TSV/XLSX from base64 or URL, or write JSON rows back to CSV.',
  iconName: 'LuTable',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'read_csv',
      label: 'Read spreadsheet',
      description: 'Parse a spreadsheet (CSV/TSV/XLSX) into JSON rows.',
      fields: [
        { id: 'format', label: 'Format', type: 'select', options: FORMAT_OPTIONS, defaultValue: 'csv' },
        { id: 'input_base64', label: 'Base64 input', type: 'textarea' },
        { id: 'url', label: 'URL input', type: 'text' },
        { id: 'sheet', label: 'Sheet name (XLSX only)', type: 'text' },
      ],
      run: readCsv,
    },
    {
      id: 'to_csv',
      label: 'Rows to CSV',
      description: 'Serialise a JSON array of objects to CSV text + base64.',
      fields: [
        { id: 'rows', label: 'Rows (JSON array)', type: 'json', required: true },
      ],
      run: toCsv,
    },
  ],
};

registerForgeBlock(block);
export default block;
