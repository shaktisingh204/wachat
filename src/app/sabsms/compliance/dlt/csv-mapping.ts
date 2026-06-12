/**
 * SabSMS V2.8 — CSV parsing + flexible column mapping for DLT registry
 * imports.
 *
 * Operator portals (Airtel/Jio/VIL/BSNL/JIO-TCCCPR aggregators) all
 * export slightly different column headings for the same data, so the
 * import flow is two-step: parse → propose a column mapping the user
 * can correct → apply.
 *
 * Pure module: no React, no server-only — shared by the client wizard
 * and the `node:test` suite.
 */

// ─── CSV parsing (RFC 4180-ish) ───────────────────────────────────────────

/**
 * Parse CSV text into rows of cells. Handles quoted cells, escaped
 * quotes (`""`), commas and newlines inside quotes, and CRLF line
 * endings. Skips fully-empty trailing lines.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      pushCell();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      // Swallow; the \n (if any) ends the row.
      if (text[i + 1] !== '\n') pushRow();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  // Final cell/row (no trailing newline).
  if (cell.length > 0 || row.length > 0) pushRow();

  // Drop rows that are entirely empty cells.
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

// ─── Import kinds + field synonyms ────────────────────────────────────────

export type DltImportKind = 'entities' | 'headers' | 'templates';

export interface DltImportField {
  /** Target field key on the wire doc (camelCase). */
  key: string;
  label: string;
  required: boolean;
  /** Normalized heading synonyms seen across operator portal exports. */
  synonyms: string[];
}

/** Lowercase and strip everything non-alphanumeric for heading compare. */
function normalizeHeading(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export const DLT_IMPORT_FIELDS: Record<DltImportKind, DltImportField[]> = {
  entities: [
    {
      key: 'peId',
      label: 'PE ID',
      required: true,
      synonyms: ['peid', 'pe', 'entityid', 'principalentityid', 'principalentity', 'peidno'],
    },
    {
      key: 'name',
      label: 'Entity name',
      required: false,
      synonyms: ['name', 'entityname', 'businessname', 'companyname', 'organisation', 'organization'],
    },
    {
      key: 'status',
      label: 'Status',
      required: false,
      synonyms: ['status', 'state', 'active'],
    },
  ],
  headers: [
    {
      key: 'headerId',
      label: 'Header ID',
      required: true,
      synonyms: ['headerid', 'hid', 'senderid', 'headeridno', 'id'],
    },
    {
      key: 'header',
      label: 'Header (sender)',
      required: true,
      synonyms: ['header', 'headername', 'sender', 'sendername', 'cli', 'senderidname'],
    },
    {
      key: 'category',
      label: 'Category',
      required: true,
      synonyms: ['category', 'headertype', 'type', 'headercategory'],
    },
  ],
  templates: [
    {
      key: 'templateId',
      label: 'Template ID',
      required: true,
      synonyms: ['templateid', 'teid', 'contenttemplateid', 'dlttemplateid', 'templateidno', 'id'],
    },
    {
      key: 'body',
      label: 'Registered body',
      required: true,
      synonyms: ['body', 'template', 'templatebody', 'content', 'message', 'templatecontent', 'contenttemplate'],
    },
    {
      key: 'category',
      label: 'Category',
      required: true,
      synonyms: ['category', 'templatetype', 'type', 'templatecategory', 'contenttype'],
    },
    {
      key: 'peId',
      label: 'PE ID',
      required: false,
      synonyms: ['peid', 'pe', 'entityid', 'principalentityid', 'principalentity'],
    },
    {
      key: 'headerIds',
      label: 'Header IDs',
      required: false,
      synonyms: ['headerids', 'headerid', 'headers', 'header', 'linkedheaders', 'approvedheaders'],
    },
    {
      key: 'status',
      label: 'Status',
      required: false,
      synonyms: ['status', 'state', 'active'],
    },
  ],
};

// ─── Mapping ──────────────────────────────────────────────────────────────

/** field key → 0-based column index, or null when unmapped. */
export type ColumnMapping = Record<string, number | null>;

/**
 * Propose a mapping from the CSV heading row to the kind's target
 * fields. Exact normalized-synonym match first, then a contains pass
 * (e.g. "PE ID (19 digit)" → peId). Each column maps to at most one
 * field, first field wins.
 */
export function guessColumnMapping(
  headings: string[],
  kind: DltImportKind,
): ColumnMapping {
  const fields = DLT_IMPORT_FIELDS[kind];
  const normalized = headings.map(normalizeHeading);
  const taken = new Set<number>();
  const mapping: ColumnMapping = {};

  // Pass 1 — exact synonym match.
  for (const field of fields) {
    const idx = normalized.findIndex(
      (h, i) => !taken.has(i) && field.synonyms.includes(h),
    );
    mapping[field.key] = idx >= 0 ? idx : null;
    if (idx >= 0) taken.add(idx);
  }
  // Pass 2 — contains match for the still-unmapped.
  for (const field of fields) {
    if (mapping[field.key] !== null) continue;
    const idx = normalized.findIndex(
      (h, i) =>
        !taken.has(i) &&
        h.length > 0 &&
        field.synonyms.some((s) => h.includes(s) || s.includes(h)),
    );
    if (idx >= 0) {
      mapping[field.key] = idx;
      taken.add(idx);
    }
  }
  return mapping;
}

/** Required fields of `kind` that `mapping` leaves unmapped. */
export function missingRequiredFields(
  mapping: ColumnMapping,
  kind: DltImportKind,
): DltImportField[] {
  return DLT_IMPORT_FIELDS[kind].filter(
    (f) => f.required && mapping[f.key] === null,
  );
}

/**
 * Apply a mapping to the data rows → plain string records keyed by
 * field key. `headerIds` is split on `|`, `;` or `,`. Rows whose
 * required cells are all empty are dropped.
 */
export function mapCsvRows(
  dataRows: string[][],
  mapping: ColumnMapping,
  kind: DltImportKind,
): Array<Record<string, string | string[]>> {
  const fields = DLT_IMPORT_FIELDS[kind];
  const out: Array<Record<string, string | string[]>> = [];

  for (const row of dataRows) {
    const record: Record<string, string | string[]> = {};
    let hasRequired = false;
    for (const field of fields) {
      const idx = mapping[field.key];
      const raw = idx !== null && idx !== undefined ? (row[idx] ?? '').trim() : '';
      if (field.key === 'headerIds') {
        record[field.key] = raw
          ? raw.split(/[|;,]/).map((s) => s.trim()).filter(Boolean)
          : [];
      } else {
        record[field.key] = raw;
      }
      if (field.required && raw.length > 0) hasRequired = true;
    }
    if (hasRequired) out.push(record);
  }
  return out;
}
