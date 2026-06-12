/**
 * Unit tests for the DLT CSV import helpers (`../csv-mapping.ts`).
 *
 *   NODE_PATH=src/workers/_stubs npx tsx --test \
 *     src/app/sabsms/compliance/dlt/__tests__/csv-mapping.test.ts
 *
 * Pure module — no React, no Mongo.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  DLT_IMPORT_FIELDS,
  guessColumnMapping,
  mapCsvRows,
  missingRequiredFields,
  parseCsv,
} from '../csv-mapping';

// ─── parseCsv ─────────────────────────────────────────────────────────────

test('parseCsv: plain rows, trailing newline ignored', () => {
  assert.deepEqual(parseCsv('a,b,c\n1,2,3\n'), [
    ['a', 'b', 'c'],
    ['1', '2', '3'],
  ]);
});

test('parseCsv: quoted cells keep commas and newlines', () => {
  const rows = parseCsv('id,body\nT1,"Hello, {#var#}.\nBye"');
  assert.deepEqual(rows, [
    ['id', 'body'],
    ['T1', 'Hello, {#var#}.\nBye'],
  ]);
});

test('parseCsv: escaped quotes ("" inside quotes)', () => {
  assert.deepEqual(parseCsv('a\n"say ""hi"""'), [['a'], ['say "hi"']]);
});

test('parseCsv: CRLF line endings', () => {
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n3,4'), [
    ['a', 'b'],
    ['1', '2'],
    ['3', '4'],
  ]);
});

test('parseCsv: bare CR ends a row too', () => {
  assert.deepEqual(parseCsv('a,b\r1,2'), [
    ['a', 'b'],
    ['1', '2'],
  ]);
});

test('parseCsv: fully-empty rows are dropped', () => {
  assert.deepEqual(parseCsv('a,b\n,\n1,2\n\n'), [
    ['a', 'b'],
    ['1', '2'],
  ]);
});

// ─── guessColumnMapping ───────────────────────────────────────────────────

test('guessColumnMapping: exact synonym match wins (headers kind)', () => {
  const mapping = guessColumnMapping(['Header ID', 'Header Name', 'Type'], 'headers');
  assert.equal(mapping.headerId, 0);
  assert.equal(mapping.header, 1);
  assert.equal(mapping.category, 2);
});

test('guessColumnMapping: contains pass catches decorated headings', () => {
  const mapping = guessColumnMapping(
    ['PE ID (19 digit)', 'Business Name', 'Status'],
    'entities',
  );
  assert.equal(mapping.peId, 0);
  assert.equal(mapping.name, 1);
  assert.equal(mapping.status, 2);
});

test('guessColumnMapping: each column maps to at most one field', () => {
  // "id" is a synonym of both templateId (exact "id") — the first field
  // takes it, the rest stay unmapped rather than double-mapping.
  const mapping = guessColumnMapping(['id'], 'templates');
  assert.equal(mapping.templateId, 0);
  assert.equal(mapping.body, null);
  assert.equal(mapping.category, null);
});

test('guessColumnMapping: unknown headings stay unmapped', () => {
  const mapping = guessColumnMapping(['zzz', 'qqq'], 'headers');
  assert.equal(mapping.headerId, null);
  assert.equal(mapping.header, null);
  assert.equal(mapping.category, null);
});

test('guessColumnMapping: real operator-portal template export', () => {
  const mapping = guessColumnMapping(
    ['Template Id', 'Template Content', 'Template Type', 'PEID', 'Approved Headers', 'State'],
    'templates',
  );
  assert.equal(mapping.templateId, 0);
  assert.equal(mapping.body, 1);
  assert.equal(mapping.category, 2);
  assert.equal(mapping.peId, 3);
  assert.equal(mapping.headerIds, 4);
  assert.equal(mapping.status, 5);
});

// ─── missingRequiredFields ────────────────────────────────────────────────

test('missingRequiredFields: reports unmapped required fields only', () => {
  const missing = missingRequiredFields(
    { headerId: 0, header: null, category: null },
    'headers',
  );
  assert.deepEqual(
    missing.map((f) => f.key),
    ['header', 'category'],
  );
});

test('missingRequiredFields: empty when all required mapped', () => {
  const mapping = { headerId: 0, header: 1, category: 2 };
  assert.equal(missingRequiredFields(mapping, 'headers').length, 0);
});

// ─── mapCsvRows ───────────────────────────────────────────────────────────

test('mapCsvRows: maps cells by index, trims, fills unmapped with empty', () => {
  const rows = mapCsvRows(
    [[' PE9 ', 'Acme Ltd']],
    { peId: 0, name: 1, status: null },
    'entities',
  );
  assert.deepEqual(rows, [{ peId: 'PE9', name: 'Acme Ltd', status: '' }]);
});

test('mapCsvRows: headerIds splits on | ; and ,', () => {
  const rows = mapCsvRows(
    [['T1', 'body', 'promotional', '', 'H1|H2; H3 ,H4']],
    { templateId: 0, body: 1, category: 2, peId: 3, headerIds: 4, status: null },
    'templates',
  );
  assert.deepEqual(rows[0].headerIds, ['H1', 'H2', 'H3', 'H4']);
});

test('mapCsvRows: empty headerIds cell becomes empty array', () => {
  const rows = mapCsvRows(
    [['T1', 'body', 'txn', '', '']],
    { templateId: 0, body: 1, category: 2, peId: 3, headerIds: 4, status: null },
    'templates',
  );
  assert.deepEqual(rows[0].headerIds, []);
});

test('mapCsvRows: rows with all required cells empty are dropped', () => {
  const rows = mapCsvRows(
    [
      ['', '', ''],
      ['H1', 'SABOTP', 'transactional'],
    ],
    { headerId: 0, header: 1, category: 2 },
    'headers',
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].headerId, 'H1');
});

test('mapCsvRows: short rows (missing trailing cells) read as empty', () => {
  const rows = mapCsvRows(
    [['H1']],
    { headerId: 0, header: 1, category: 2 },
    'headers',
  );
  assert.deepEqual(rows, [{ headerId: 'H1', header: '', category: '' }]);
});

// ─── Field catalog sanity ────────────────────────────────────────────────

test('every import kind has its natural-key field marked required', () => {
  assert.ok(DLT_IMPORT_FIELDS.entities.find((f) => f.key === 'peId')?.required);
  assert.ok(DLT_IMPORT_FIELDS.headers.find((f) => f.key === 'headerId')?.required);
  assert.ok(DLT_IMPORT_FIELDS.templates.find((f) => f.key === 'templateId')?.required);
});
