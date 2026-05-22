/**
 * SabSMS imports — pure CSV parsing + column-mapping inference.
 *
 * Lives outside the server-actions surface so it can run in a worker, a
 * test, or directly in the browser preview pane. No I/O, no Mongo.
 *
 * The parser handles:
 *  - Quoted fields with embedded commas, newlines, and escaped quotes
 *    (RFC-4180 "" escape).
 *  - Whitespace-only lines (skipped silently).
 *  - Mismatched column counts (reported as a `ParseError`, but the row
 *    is still emitted so the preview pane can show the user what we
 *    saw).
 *
 * `inferColumnMapping` looks at the header row and picks the best
 * candidate for phone / name / email / tags so the wizard can prefill
 * the mapping step without any user interaction.
 */

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: ParseError[];
}

/**
 * Parse a CSV string into a header row + an array of row records keyed
 * by header name. Pure, no I/O.
 */
export function parseCsv(text: string): ParseResult {
  const headers: string[] = [];
  const rows: Record<string, string>[] = [];
  const errors: ParseError[] = [];

  if (text === undefined || text === null) {
    return { headers, rows, errors };
  }

  // Strip BOM if present (Excel-exported CSV is often UTF-8-BOM).
  let input = text;
  if (input.charCodeAt(0) === 0xfeff) {
    input = input.slice(1);
  }
  // Normalise line endings to \n so we don't have to branch in the loop.
  input = input.replace(/\r\n?/g, "\n");

  const records = tokenize(input, errors);
  if (records.length === 0) {
    return { headers, rows, errors };
  }

  const headerRecord = records[0];
  for (const cell of headerRecord) {
    headers.push(cell.trim());
  }

  for (let r = 1; r < records.length; r++) {
    const record = records[r];
    // Skip blank lines (a single empty cell with no content).
    if (record.length === 1 && record[0].trim() === "") continue;

    if (record.length !== headers.length) {
      errors.push({
        line: r + 1,
        message: `Expected ${headers.length} columns, saw ${record.length}.`,
      });
    }
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = record[c] ?? "";
    }
    rows.push(row);
  }

  return { headers, rows, errors };
}

/**
 * Tokenise the CSV text into a list of records (each record is a list of
 * cell strings). Implements RFC-4180 with the "" quote-escape rule.
 */
function tokenize(text: string, errors: ParseError[]): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let inQuotes = false;
  let line = 1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // Lookahead — "" inside a quoted field is a literal quote.
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      if (cell.length === 0) {
        inQuotes = true;
      } else {
        // Stray quote mid-cell — accept it but flag.
        errors.push({
          line,
          message: "Stray quote inside an unquoted field.",
        });
        cell += '"';
      }
      continue;
    }
    if (ch === ",") {
      record.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      record.push(cell);
      records.push(record);
      record = [];
      cell = "";
      line++;
      continue;
    }
    cell += ch;
  }

  // Flush any trailing content (file without a final newline).
  if (cell.length > 0 || record.length > 0) {
    record.push(cell);
    records.push(record);
  }
  if (inQuotes) {
    errors.push({
      line,
      message: "Unterminated quoted field at end of file.",
    });
  }

  return records;
}

// ─── Column mapping inference ────────────────────────────────────────────

export interface ColumnMapping {
  phone?: string;
  name?: string;
  email?: string;
  tags?: string;
}

const PHONE_KEYWORDS = [
  "phone",
  "mobile",
  "msisdn",
  "number",
  "tel",
  "telephone",
  "cell",
  "whatsapp",
  "wa",
  "sms",
];
const NAME_KEYWORDS = [
  "name",
  "fullname",
  "full_name",
  "contact",
  "person",
  "customer",
  "first",
  "firstname",
  "last",
  "lastname",
];
const EMAIL_KEYWORDS = ["email", "mail", "e_mail", "e-mail"];
const TAG_KEYWORDS = ["tag", "tags", "label", "labels", "category", "segment"];

function matchHeader(
  headers: string[],
  keywords: string[],
): string | undefined {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h === kw);
    if (idx !== -1) return headers[idx];
  }
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h.includes(kw));
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

/**
 * Best-effort column mapping. Returns the matched header *names* (so
 * the caller can render the wizard with sensible defaults). Picks the
 * first header that contains the keyword.
 */
export function inferColumnMapping(headers: string[]): ColumnMapping {
  return {
    phone: matchHeader(headers, PHONE_KEYWORDS),
    name: matchHeader(headers, NAME_KEYWORDS),
    email: matchHeader(headers, EMAIL_KEYWORDS),
    tags: matchHeader(headers, TAG_KEYWORDS),
  };
}

// ─── Phone normalisation ─────────────────────────────────────────────────

/**
 * Best-effort E.164 normalisation. If `libphonenumber-js` is installed
 * the caller can plug it in; otherwise this regex covers the common
 * "+CC followed by digits" pattern most contact CSVs already use.
 */
export function normalisePhone(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // Strip everything except digits and a leading "+".
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    // Must be +<country><number>, total digits 8-15.
    const digits = cleaned.slice(1);
    if (/^\d{8,15}$/.test(digits)) return `+${digits}`;
    return null;
  }
  // No "+" — assume the user meant E.164 already and the "+" was lost.
  if (/^\d{10,15}$/.test(cleaned)) return `+${cleaned}`;
  return null;
}

/**
 * Detect duplicate phones in a parsed row set. Returns the list of
 * phone strings that appear more than once after normalisation.
 */
export function findDuplicatePhones(
  rows: Record<string, string>[],
  phoneCol: string,
): string[] {
  const seen = new Map<string, number>();
  for (const r of rows) {
    const norm = normalisePhone(r[phoneCol] ?? "");
    if (!norm) continue;
    seen.set(norm, (seen.get(norm) ?? 0) + 1);
  }
  const dupes: string[] = [];
  for (const [phone, count] of seen) {
    if (count > 1) dupes.push(phone);
  }
  return dupes;
}
