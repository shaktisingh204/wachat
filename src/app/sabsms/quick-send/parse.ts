/**
 * Pure parser for the SabSMS Quick-Send paste box.
 *
 * Accepts three input shapes:
 *   1. One phone per line (E.164 or close enough — we normalise).
 *   2. Comma-separated phones on a single line ("+1...,+1...").
 *   3. TSV/CSV with a header row whose first column is "phone" (any
 *      case) — every other column becomes a variable on the row.
 *
 * Phone normalisation:
 *   - Strips whitespace, dashes, parens, dots.
 *   - Accepts a leading "+" — if missing but the digits look like a
 *     plausible international number (10-15 digits), we prepend "+".
 *   - libphonenumber-js is preferred when present in `package.json`
 *     (currently it is NOT, so the regex fallback is the live path).
 *
 * Output is deterministic: dedupe preserves the first occurrence and
 * carries that row's variables; later duplicates record a `duplicate`
 * parse error pointing back at the first hit's line number.
 *
 * NOTE: This file is intentionally dependency-free so the tests can run
 * under `tsx --test` without the Next.js server boot path.
 */

export interface RecipientRow {
  /** E.164 phone (e.g. "+15551234567"). */
  phone: string;
  /** Variables harvested from the TSV/CSV columns. */
  vars: Record<string, string>;
  /** 1-indexed source line in the original paste. */
  sourceLine: number;
}

export type ParseErrorKind =
  | "empty"
  | "invalid_phone"
  | "duplicate"
  | "column_mismatch"
  | "missing_phone_column";

export interface ParseError {
  /** 1-indexed source line in the original paste. */
  line: number;
  raw: string;
  kind: ParseErrorKind;
  message: string;
}

export interface ParseResult {
  rows: RecipientRow[];
  errors: ParseError[];
  /** When non-null, the input was interpreted as TSV/CSV with headers. */
  variableColumns: string[] | null;
}

// ─── Phone normalisation ──────────────────────────────────────────────────

const PHONE_STRIP_RE = /[\s\-().·]/g;
const ALL_DIGITS_RE = /^\+?\d{8,15}$/;

/**
 * Normalises a raw phone into E.164. Returns `null` on failure.
 *
 * Strategy:
 *   - Strip cosmetic characters.
 *   - Anything not matching `^\+?\d{8,15}$` is rejected.
 *   - A leading "+" is preserved; if missing, we add one when the digit
 *     count is plausible (>= 10) — this matches how composer.tsx leaves
 *     final normalisation to the engine, but rejects clearly-invalid
 *     input client-side.
 */
export function normalisePhone(raw: string): string | null {
  if (!raw) return null;
  const stripped = raw.replace(PHONE_STRIP_RE, "");
  if (!ALL_DIGITS_RE.test(stripped)) return null;
  if (stripped.startsWith("+")) return stripped;
  // Heuristic: treat 10+ digits without a "+" as international-grade.
  if (stripped.length >= 10) return `+${stripped}`;
  return null;
}

// ─── Format detection ─────────────────────────────────────────────────────

function detectDelimiter(headerLine: string): "tab" | "comma" | null {
  const hasTab = headerLine.includes("\t");
  const hasComma = headerLine.includes(",");
  if (hasTab) return "tab";
  if (hasComma) return "comma";
  return null;
}

function splitDelimited(line: string, delim: "tab" | "comma"): string[] {
  if (delim === "tab") return line.split("\t").map((c) => c.trim());
  // CSV split — naive (no quoted-field support). The paste box advertises
  // TSV in the placeholder; CSV here is mostly a courtesy.
  return line.split(",").map((c) => c.trim());
}

/**
 * Heuristic: the first non-empty line is a header if it starts with the
 * literal "phone" token (case-insensitive) in its first column AND the
 * line contains a delimiter.
 */
function looksLikeHeader(line: string): boolean {
  const delim = detectDelimiter(line);
  if (!delim) return false;
  const cells = splitDelimited(line, delim);
  if (cells.length < 2) return false;
  return cells[0].trim().toLowerCase() === "phone";
}

// ─── Main entry point ─────────────────────────────────────────────────────

export function parseRecipientList(input: string): ParseResult {
  const result: ParseResult = { rows: [], errors: [], variableColumns: null };

  if (!input || !input.trim()) {
    result.errors.push({
      line: 1,
      raw: "",
      kind: "empty",
      message: "Paste at least one recipient.",
    });
    return result;
  }

  // First pass: split into non-empty source lines, preserving line numbers.
  const rawLines = input.replace(/\r\n/g, "\n").split("\n");

  // Find first non-empty line to decide on TSV/CSV vs plain mode.
  const firstNonEmpty = rawLines.findIndex((l) => l.trim() !== "");
  if (firstNonEmpty === -1) {
    result.errors.push({
      line: 1,
      raw: "",
      kind: "empty",
      message: "Paste at least one recipient.",
    });
    return result;
  }

  const firstLine = rawLines[firstNonEmpty];

  // Headered TSV/CSV branch.
  if (looksLikeHeader(firstLine)) {
    const delim = detectDelimiter(firstLine);
    if (!delim) {
      result.errors.push({
        line: firstNonEmpty + 1,
        raw: firstLine,
        kind: "missing_phone_column",
        message: "Header row needs a tab or comma between columns.",
      });
      return result;
    }
    const headerCells = splitDelimited(firstLine, delim);
    const variableColumns = headerCells.slice(1);
    result.variableColumns = variableColumns;

    const seen = new Map<string, number>();

    for (let i = firstNonEmpty + 1; i < rawLines.length; i++) {
      const raw = rawLines[i];
      const lineNo = i + 1;
      if (!raw.trim()) continue;

      const cells = splitDelimited(raw, delim);
      if (cells.length !== headerCells.length) {
        result.errors.push({
          line: lineNo,
          raw,
          kind: "column_mismatch",
          message: `Expected ${headerCells.length} columns, got ${cells.length}.`,
        });
        continue;
      }

      const phoneRaw = cells[0];
      const phone = normalisePhone(phoneRaw);
      if (!phone) {
        result.errors.push({
          line: lineNo,
          raw,
          kind: "invalid_phone",
          message: `"${phoneRaw}" is not a valid E.164 phone.`,
        });
        continue;
      }

      const seenAt = seen.get(phone);
      if (seenAt !== undefined) {
        result.errors.push({
          line: lineNo,
          raw,
          kind: "duplicate",
          message: `Already listed on line ${seenAt}.`,
        });
        continue;
      }

      const vars: Record<string, string> = {};
      for (let c = 1; c < headerCells.length; c++) {
        const key = headerCells[c];
        if (key) vars[key] = cells[c] ?? "";
      }

      seen.set(phone, lineNo);
      result.rows.push({ phone, vars, sourceLine: lineNo });
    }

    return result;
  }

  // Plain branch — newline- or comma-separated phones, no variables.
  const seen = new Map<string, number>();

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const lineNo = i + 1;
    if (!raw.trim()) continue;

    // A single line can carry multiple comma-separated phones.
    const tokens = raw.includes(",")
      ? raw.split(",").map((t) => t.trim()).filter((t) => t)
      : [raw.trim()];

    for (const tok of tokens) {
      const phone = normalisePhone(tok);
      if (!phone) {
        result.errors.push({
          line: lineNo,
          raw: tok,
          kind: "invalid_phone",
          message: `"${tok}" is not a valid E.164 phone.`,
        });
        continue;
      }
      const seenAt = seen.get(phone);
      if (seenAt !== undefined) {
        result.errors.push({
          line: lineNo,
          raw: tok,
          kind: "duplicate",
          message: `Already listed on line ${seenAt}.`,
        });
        continue;
      }
      seen.set(phone, lineNo);
      result.rows.push({ phone, vars: {}, sourceLine: lineNo });
    }
  }

  return result;
}

// ─── Helpers used by the client ───────────────────────────────────────────

/**
 * Replaces `{{var}}` placeholders in `body` with values from `vars`.
 * Unknown keys are left as-is so the preview surfaces the gap.
 */
export function interpolateBody(
  body: string,
  vars: Record<string, string>,
): string {
  return body.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, key: string) => {
    if (key in vars) return vars[key];
    return `{{${key}}}`;
  });
}

/**
 * Mirror of the GSM-7 / UCS-2 segment math used in composer.tsx — kept
 * here so quick-send can compute a live total without importing the
 * client component.
 */
export function segmentCount(body: string): {
  segments: number;
  encoding: "GSM-7" | "UCS-2";
} {
  if (!body) return { segments: 0, encoding: "GSM-7" };
  const isGsm = /^[\x20-\x7E\n\r£¥€§Æ¡¿äöüÄÖÜñÑàèéìòùÇß]*$/.test(body);
  if (isGsm) {
    const len = body.length;
    return {
      segments: len <= 160 ? 1 : Math.ceil(len / 153),
      encoding: "GSM-7",
    };
  }
  const len = [...body].length;
  return {
    segments: len <= 70 ? 1 : Math.ceil(len / 67),
    encoding: "UCS-2",
  };
}
