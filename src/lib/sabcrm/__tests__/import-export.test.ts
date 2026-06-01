/**
 * Unit tests for the edge-hardening changes in
 * `src/lib/sabcrm/import-export.server.ts`.
 *
 * Covers:
 *   - Exported constants (MAX_IMPORT_ROWS, MAX_EXPORT_ROWS, MAX_ROW_ERRORS)
 *   - `_coerceCell` — all FieldTypes (internal export, no Mongo required)
 *   - `_validateRow` — per-row error cap, unknown-column skip, required-field
 *     checks (internal export, no Mongo required)
 *
 * Does NOT cover: importRecords, exportRecords, buildColumnMappingSuggestions,
 * validateImportMapping, exportAllObjectHeaders — all of these call MongoDB
 * and require a live connection; they are covered by integration tests.
 *
 * Run:
 *   npx tsx --test src/lib/sabcrm/__tests__/import-export.test.ts
 *
 * The `server-only` import at the top of import-export.server.ts is satisfied
 * by the no-op stub in node_modules/server-only/index.js. The db / records /
 * objects imports are evaluated for their types only; no async functions are
 * called from this test file.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  MAX_IMPORT_ROWS,
  MAX_EXPORT_ROWS,
  MAX_ROW_ERRORS,
  _coerceCell,
  _validateRow,
} from '../import-export.server';

import type { FieldMetadata, ObjectMetadata } from '../types';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

function makeField(overrides: Partial<FieldMetadata> & { key: string; label: string; type: FieldMetadata['type'] }): FieldMetadata {
  return { required: false, ...overrides };
}

function makeObject(fields: FieldMetadata[]): ObjectMetadata {
  return {
    slug: 'test-obj',
    labelSingular: 'Test',
    labelPlural: 'Tests',
    icon: 'box',
    views: ['table'],
    fields,
  };
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

describe('exported constants', () => {
  it('MAX_IMPORT_ROWS is 5_000', () => {
    assert.equal(MAX_IMPORT_ROWS, 5_000);
  });

  it('MAX_EXPORT_ROWS is 10_000', () => {
    assert.equal(MAX_EXPORT_ROWS, 10_000);
  });

  it('MAX_ROW_ERRORS is 20', () => {
    assert.equal(MAX_ROW_ERRORS, 20);
  });
});

/* -------------------------------------------------------------------------- */
/* coerceCell — TEXT / EMAIL / PHONE / LINK                                   */
/* -------------------------------------------------------------------------- */

describe('_coerceCell — text-like fields', () => {
  const textField = makeField({ key: 'name', label: 'Name', type: 'TEXT' });

  it('returns trimmed string for TEXT', () => {
    const result = _coerceCell('  hello  ', textField);
    assert.deepEqual(result, { ok: true, value: 'hello' });
  });

  it('returns undefined for empty optional TEXT cell', () => {
    const result = _coerceCell('', textField);
    assert.deepEqual(result, { ok: true, value: undefined });
  });

  it('returns error for empty required TEXT cell', () => {
    const req = makeField({ key: 'name', label: 'Name', type: 'TEXT', required: true });
    const result = _coerceCell('', req);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.error.includes('Name'));
  });

  for (const type of ['EMAIL', 'PHONE', 'LINK'] as const) {
    it(`returns string as-is for ${type}`, () => {
      const f = makeField({ key: 'f', label: 'F', type });
      const r = _coerceCell('test@example.com', f);
      assert.deepEqual(r, { ok: true, value: 'test@example.com' });
    });
  }
});

/* -------------------------------------------------------------------------- */
/* coerceCell — NUMBER                                                        */
/* -------------------------------------------------------------------------- */

describe('_coerceCell — NUMBER', () => {
  const numField = makeField({ key: 'qty', label: 'Quantity', type: 'NUMBER' });

  it('parses integer', () => {
    assert.deepEqual(_coerceCell('42', numField), { ok: true, value: 42 });
  });

  it('parses decimal', () => {
    assert.deepEqual(_coerceCell('3.14', numField), { ok: true, value: 3.14 });
  });

  it('strips thousands comma', () => {
    assert.deepEqual(_coerceCell('1,234', numField), { ok: true, value: 1234 });
  });

  it('rejects alphabetic string', () => {
    const r = _coerceCell('abc', numField);
    assert.equal(r.ok, false);
  });

  it('rejects Infinity literal', () => {
    const r = _coerceCell('Infinity', numField);
    assert.equal(r.ok, false);
  });

  it('rejects NaN literal', () => {
    const r = _coerceCell('NaN', numField);
    assert.equal(r.ok, false);
  });
});

/* -------------------------------------------------------------------------- */
/* coerceCell — CURRENCY                                                      */
/* -------------------------------------------------------------------------- */

describe('_coerceCell — CURRENCY', () => {
  const currField = makeField({ key: 'amount', label: 'Amount', type: 'CURRENCY' });

  it('strips currency symbol and parses number', () => {
    const r = _coerceCell('$1,234.56', currField);
    assert.deepEqual(r, { ok: true, value: 1234.56 });
  });

  it('handles negative currency', () => {
    const r = _coerceCell('-99.50', currField);
    assert.deepEqual(r, { ok: true, value: -99.50 });
  });

  it('rejects non-numeric garbage', () => {
    const r = _coerceCell('abc', currField);
    assert.equal(r.ok, false);
  });
});

/* -------------------------------------------------------------------------- */
/* coerceCell — BOOLEAN                                                       */
/* -------------------------------------------------------------------------- */

describe('_coerceCell — BOOLEAN', () => {
  const boolField = makeField({ key: 'active', label: 'Active', type: 'BOOLEAN' });

  for (const truthy of ['true', 'True', 'TRUE', 'yes', 'Yes', '1', 'y', 'on']) {
    it(`"${truthy}" → true`, () => {
      const r = _coerceCell(truthy, boolField);
      assert.deepEqual(r, { ok: true, value: true });
    });
  }

  for (const falsy of ['false', 'False', 'FALSE', 'no', 'No', '0', 'n', 'off']) {
    it(`"${falsy}" → false`, () => {
      const r = _coerceCell(falsy, boolField);
      assert.deepEqual(r, { ok: true, value: false });
    });
  }

  it('rejects unrecognised boolean string', () => {
    const r = _coerceCell('maybe', boolField);
    assert.equal(r.ok, false);
  });
});

/* -------------------------------------------------------------------------- */
/* coerceCell — DATE                                                           */
/* -------------------------------------------------------------------------- */

describe('_coerceCell — DATE', () => {
  const dateField = makeField({ key: 'dob', label: 'Date of Birth', type: 'DATE' });

  it('parses ISO date and slices to YYYY-MM-DD', () => {
    const r = _coerceCell('2024-03-15', dateField);
    assert.deepEqual(r, { ok: true, value: '2024-03-15' });
  });

  it('parses ISO datetime and slices to date portion', () => {
    const r = _coerceCell('2024-03-15T12:00:00.000Z', dateField);
    if (!r.ok) throw new Error(r.error);
    assert.ok((r.value as string).startsWith('2024-03-15'));
  });

  it('rejects invalid date string', () => {
    const r = _coerceCell('not-a-date', dateField);
    assert.equal(r.ok, false);
  });
});

/* -------------------------------------------------------------------------- */
/* coerceCell — DATE_TIME                                                      */
/* -------------------------------------------------------------------------- */

describe('_coerceCell — DATE_TIME', () => {
  const dtField = makeField({ key: 'ts', label: 'Timestamp', type: 'DATE_TIME' });

  it('parses and emits ISO string', () => {
    const r = _coerceCell('2024-03-15T12:00:00.000Z', dtField);
    assert.deepEqual(r, { ok: true, value: '2024-03-15T12:00:00.000Z' });
  });

  it('rejects invalid datetime', () => {
    const r = _coerceCell('32-13-2024', dtField);
    assert.equal(r.ok, false);
  });
});

/* -------------------------------------------------------------------------- */
/* coerceCell — SELECT                                                        */
/* -------------------------------------------------------------------------- */

describe('_coerceCell — SELECT', () => {
  const selField = makeField({
    key: 'status',
    label: 'Status',
    type: 'SELECT',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
  });

  it('matches by value (case-insensitive)', () => {
    assert.deepEqual(_coerceCell('OPEN', selField), { ok: true, value: 'open' });
  });

  it('matches by label (case-insensitive)', () => {
    assert.deepEqual(_coerceCell('Closed', selField), { ok: true, value: 'closed' });
  });

  it('rejects unknown option', () => {
    const r = _coerceCell('pending', selField);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.includes('open'));
  });

  it('returns error listing (none defined) when no options', () => {
    const noOpts = makeField({ key: 's', label: 'S', type: 'SELECT' });
    const r = _coerceCell('anything', noOpts);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.includes('(none defined)'));
  });
});

/* -------------------------------------------------------------------------- */
/* coerceCell — MULTI_SELECT                                                  */
/* -------------------------------------------------------------------------- */

describe('_coerceCell — MULTI_SELECT', () => {
  const msField = makeField({
    key: 'tags',
    label: 'Tags',
    type: 'MULTI_SELECT',
    options: [
      { value: 'red', label: 'Red' },
      { value: 'blue', label: 'Blue' },
      { value: 'green', label: 'Green' },
    ],
  });

  it('parses pipe-separated values', () => {
    const r = _coerceCell('red|blue', msField);
    assert.deepEqual(r, { ok: true, value: ['red', 'blue'] });
  });

  it('parses comma-separated values', () => {
    const r = _coerceCell('red,green', msField);
    assert.deepEqual(r, { ok: true, value: ['red', 'green'] });
  });

  it('matches by label', () => {
    const r = _coerceCell('Red|Blue', msField);
    assert.deepEqual(r, { ok: true, value: ['red', 'blue'] });
  });

  it('rejects any unknown option in the list', () => {
    const r = _coerceCell('red|purple', msField);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.includes('purple'));
  });
});

/* -------------------------------------------------------------------------- */
/* coerceCell — RATING                                                        */
/* -------------------------------------------------------------------------- */

describe('_coerceCell — RATING', () => {
  const ratingField = makeField({ key: 'stars', label: 'Stars', type: 'RATING' });

  for (const n of [1, 2, 3, 4, 5]) {
    it(`accepts ${n}`, () => {
      assert.deepEqual(_coerceCell(String(n), ratingField), { ok: true, value: n });
    });
  }

  it('rejects 0', () => {
    assert.equal(_coerceCell('0', ratingField).ok, false);
  });

  it('rejects 6', () => {
    assert.equal(_coerceCell('6', ratingField).ok, false);
  });

  it('rejects decimal', () => {
    assert.equal(_coerceCell('3.5', ratingField).ok, false);
  });
});

/* -------------------------------------------------------------------------- */
/* coerceCell — RELATION / FILE (always skip)                                 */
/* -------------------------------------------------------------------------- */

describe('_coerceCell — RELATION and FILE fields are always skipped', () => {
  it('RELATION returns undefined value regardless of input', () => {
    const f = makeField({ key: 'company', label: 'Company', type: 'RELATION' });
    assert.deepEqual(_coerceCell('some-id', f), { ok: true, value: undefined });
    assert.deepEqual(_coerceCell('', f), { ok: true, value: undefined });
  });

  it('FILE returns undefined value regardless of input', () => {
    const f = makeField({ key: 'avatar', label: 'Avatar', type: 'FILE' });
    assert.deepEqual(_coerceCell('https://cdn.example.com/img.png', f), { ok: true, value: undefined });
  });
});

/* -------------------------------------------------------------------------- */
/* validateRow — basic happy-path                                              */
/* -------------------------------------------------------------------------- */

describe('_validateRow — basic success', () => {
  const nameField = makeField({ key: 'name', label: 'Name', type: 'TEXT', required: true });
  const ageField  = makeField({ key: 'age',  label: 'Age',  type: 'NUMBER' });
  const obj = makeObject([nameField, ageField]);
  const mapping = { name: 'Full Name', age: 'Age' };

  it('produces data map for a valid row', () => {
    const row = { 'Full Name': 'Alice', 'Age': '30' };
    const r = _validateRow(row, obj, mapping);
    assert.deepEqual(r, { ok: true, data: { name: 'Alice', age: 30 } });
  });

  it('omits undefined values (optional empty cell)', () => {
    const row = { 'Full Name': 'Bob', 'Age': '' };
    const r = _validateRow(row, obj, mapping);
    assert.deepEqual(r, { ok: true, data: { name: 'Bob' } });
  });
});

/* -------------------------------------------------------------------------- */
/* validateRow — unknown column skip                                           */
/* -------------------------------------------------------------------------- */

describe('_validateRow — unknown columns are silently skipped', () => {
  const nameField = makeField({ key: 'name', label: 'Name', type: 'TEXT', required: true });
  const obj = makeObject([nameField]);
  const mapping = { name: 'Name' };

  it('ignores extra columns not present in the mapping', () => {
    // "Extra Column" is in rawRow but not referenced by any field mapping.
    const row = { 'Name': 'Charlie', 'Extra Column': 'some junk' };
    const r = _validateRow(row, obj, mapping);
    assert.deepEqual(r, { ok: true, data: { name: 'Charlie' } });
  });

  it('treats a mapping pointing at a missing CSV header as empty cell', () => {
    // mapping says name → 'Name' but 'Name' is absent from rawRow.
    const row = { 'Other': 'data' };
    const r = _validateRow(row, obj, mapping);
    // 'name' is required with no default → validation error.
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors[0].includes('Name'));
  });
});

/* -------------------------------------------------------------------------- */
/* validateRow — required-field check                                          */
/* -------------------------------------------------------------------------- */

describe('_validateRow — required fields with no mapping', () => {
  const nameField = makeField({ key: 'name', label: 'Name', type: 'TEXT', required: true });
  const obj = makeObject([nameField]);

  it('reports error when required field has no mapping and no default', () => {
    const r = _validateRow({}, obj, {} /* empty mapping */);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.some((e) => e.includes('Name')));
  });

  it('no error when required field has a default value', () => {
    const withDefault = makeField({
      key: 'name', label: 'Name', type: 'TEXT', required: true, defaultValue: 'Unknown',
    });
    const o = makeObject([withDefault]);
    const r = _validateRow({}, o, {});
    assert.equal(r.ok, true);
  });
});

/* -------------------------------------------------------------------------- */
/* validateRow — per-row error cap (MAX_ROW_ERRORS)                           */
/* -------------------------------------------------------------------------- */

describe('_validateRow — error count is capped at MAX_ROW_ERRORS', () => {
  it('never returns more than MAX_ROW_ERRORS errors per row', () => {
    // Build an object with (MAX_ROW_ERRORS + 5) required fields, none mapped.
    const fields: FieldMetadata[] = [];
    for (let i = 0; i < MAX_ROW_ERRORS + 5; i++) {
      fields.push(makeField({
        key: `field${i}`,
        label: `Field ${i}`,
        type: 'TEXT',
        required: true,
      }));
    }
    const obj = makeObject(fields);
    const r = _validateRow({}, obj, {});
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(
        r.errors.length <= MAX_ROW_ERRORS,
        `Expected ≤ ${MAX_ROW_ERRORS} errors, got ${r.errors.length}`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/* validateRow — RELATION and FILE fields are always skipped                  */
/* -------------------------------------------------------------------------- */

describe('_validateRow — RELATION / FILE fields skipped even if mapped', () => {
  it('does not add RELATION or FILE keys to data even when mapped', () => {
    const relField = makeField({ key: 'company', label: 'Company', type: 'RELATION', required: true });
    const fileField = makeField({ key: 'doc', label: 'Doc', type: 'FILE', required: true });
    const nameField = makeField({ key: 'name', label: 'Name', type: 'TEXT', required: true });
    const obj = makeObject([relField, fileField, nameField]);
    const mapping = { company: 'Company', doc: 'Doc', name: 'Name' };
    const row = { 'Company': 'some-id', 'Doc': 'file-id', 'Name': 'Alice' };
    const r = _validateRow(row, obj, mapping);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.ok(!('company' in r.data), 'RELATION key should not appear in data');
      assert.ok(!('doc' in r.data), 'FILE key should not appear in data');
      assert.equal(r.data['name'], 'Alice');
    }
  });
});
