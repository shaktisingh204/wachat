/**
 * RFC 4180 CSV parser + serializer. No external dependency.
 *
 * Handles:
 *   - Quoted fields with embedded commas, quotes, and newlines
 *   - Trailing newline (last row is empty → dropped)
 *   - CRLF + LF line endings
 *
 * Does NOT auto-detect delimiters; pass `delimiter` to override "," .
 */

export interface ParseCsvOptions {
  delimiter?: string;
  /** First non-empty row is treated as the header. Defaults to true. */
  hasHeader?: boolean;
  /** Trim each cell. Defaults to true. */
  trim?: boolean;
}

export interface ParsedCsv {
  /** Column headers, in source order. Empty when `hasHeader === false`. */
  headers: string[];
  /** Data rows. Each row is a `Record<header, cell>` when headers exist, else `string[]`. */
  rows: Array<Record<string, string>>;
  /**
   * `rows.length` again, kept for parity with status/dry-run reports.
   */
  rowCount: number;
  /** Cells that exceeded the row's expected column count, by 1-based row. */
  malformedRowsByIndex: number[];
}

export function parseCsv(input: string, opts: ParseCsvOptions = {}): ParsedCsv {
  const delimiter = opts.delimiter ?? ',';
  const hasHeader = opts.hasHeader !== false;
  const trim = opts.trim !== false;

  const out: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      row.push(trim ? cur.trim() : cur);
      cur = '';
      i += 1;
      continue;
    }
    if (ch === '\r' && input[i + 1] === '\n') {
      row.push(trim ? cur.trim() : cur);
      out.push(row);
      row = [];
      cur = '';
      i += 2;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      row.push(trim ? cur.trim() : cur);
      out.push(row);
      row = [];
      cur = '';
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }
  // Flush trailing row if non-empty.
  if (cur.length > 0 || row.length > 0) {
    row.push(trim ? cur.trim() : cur);
    out.push(row);
  }

  // Drop trailing empty rows (single empty-string cell).
  while (
    out.length > 0 &&
    out[out.length - 1]!.length === 1 &&
    out[out.length - 1]![0] === ''
  ) {
    out.pop();
  }

  if (out.length === 0) {
    return { headers: [], rows: [], rowCount: 0, malformedRowsByIndex: [] };
  }

  let headers: string[] = [];
  let dataStart = 0;
  if (hasHeader) {
    headers = out[0]!.map((h) => (trim ? h.trim() : h));
    dataStart = 1;
  }

  const rows: Array<Record<string, string>> = [];
  const malformed: number[] = [];
  for (let r = dataStart; r < out.length; r += 1) {
    const raw = out[r]!;
    if (hasHeader) {
      const record: Record<string, string> = {};
      for (let c = 0; c < headers.length; c += 1) {
        record[headers[c]!] = raw[c] ?? '';
      }
      rows.push(record);
      if (raw.length !== headers.length) {
        malformed.push(r + 1);
      }
    } else {
      const record: Record<string, string> = {};
      for (let c = 0; c < raw.length; c += 1) {
        record[String(c)] = raw[c]!;
      }
      rows.push(record);
    }
  }

  return {
    headers,
    rows,
    rowCount: rows.length,
    malformedRowsByIndex: malformed,
  };
}

/* ─── Serialize ────────────────────────────────────────────────── */

export interface SerializeCsvOptions {
  delimiter?: string;
  /** If false, omit the header row. Defaults to true. */
  withHeader?: boolean;
  /** Force CRLF line endings (Excel friendly). Defaults to false (LF). */
  crlf?: boolean;
}

function escapeCell(s: string, delimiter: string): string {
  if (
    s.includes(delimiter) ||
    s.includes('"') ||
    s.includes('\n') ||
    s.includes('\r')
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  return JSON.stringify(v);
}

export function serializeCsv<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns: readonly (keyof T & string)[],
  opts: SerializeCsvOptions = {},
): string {
  const delimiter = opts.delimiter ?? ',';
  const eol = opts.crlf ? '\r\n' : '\n';
  const lines: string[] = [];

  if (opts.withHeader !== false) {
    lines.push(columns.map((c) => escapeCell(c, delimiter)).join(delimiter));
  }

  for (const row of rows) {
    const cells = columns.map((col) =>
      escapeCell(cellToString(row[col]), delimiter),
    );
    lines.push(cells.join(delimiter));
  }

  return lines.join(eol);
}
