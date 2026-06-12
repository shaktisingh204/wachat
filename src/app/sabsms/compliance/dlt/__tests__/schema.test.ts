/**
 * Wire-contract tests for the DLT registry zod schemas (`../schema.ts`).
 *
 *   NODE_PATH=src/workers/_stubs npx tsx --test \
 *     src/app/sabsms/compliance/dlt/__tests__/schema.test.ts
 *
 * The Mongo docs these schemas produce are read VERBATIM by the Rust
 * engine's registry loader (`services/sabsms-engine/src/compliance/
 * dlt_store.rs` — `template_from_doc` / `header_from_doc` /
 * `chain_from_doc`), so the round-trip assertions here pin the TS half
 * of that contract: camelCase field names, snake_case categories
 * exactly as `DltCategory::parse` normalizes them, and the TRAI 2-TM
 * chain cap.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  DLT_CATEGORIES,
  DLT_CATEGORY_SUFFIX,
  dltChainInputSchema,
  dltEntityInputSchema,
  dltHeaderInputSchema,
  dltTemplateInputSchema,
  normalizeDltCategory,
} from '../schema';

// ─── Category normalization (mirror of Rust DltCategory::parse) ──────────

test('normalizeDltCategory matches DltCategory::parse synonym-for-synonym', () => {
  // Same cases as the Rust unit tests in compliance/dlt.rs.
  assert.equal(normalizeDltCategory('Promotional'), 'promotional');
  assert.equal(normalizeDltCategory('service-explicit'), 'service_explicit');
  assert.equal(normalizeDltCategory('Service Implicit'), 'service_implicit');
  assert.equal(normalizeDltCategory('promo'), 'promotional');
  assert.equal(normalizeDltCategory('P'), 'promotional');
  assert.equal(normalizeDltCategory('se'), 'service_explicit');
  assert.equal(normalizeDltCategory('service'), 'service_implicit');
  assert.equal(normalizeDltCategory('si'), 'service_implicit');
  assert.equal(normalizeDltCategory('TXN'), 'transactional');
  assert.equal(normalizeDltCategory('t'), 'transactional');
  assert.equal(normalizeDltCategory('govt'), 'government');
  assert.equal(normalizeDltCategory('G'), 'government');
  assert.equal(normalizeDltCategory('nope'), null);
  assert.equal(normalizeDltCategory(''), null);
});

test('every stored category value normalizes to itself (round-trip stable)', () => {
  for (const cat of DLT_CATEGORIES) {
    assert.equal(normalizeDltCategory(cat), cat);
    assert.ok(DLT_CATEGORY_SUFFIX[cat], `suffix missing for ${cat}`);
  }
});

test('operator suffixes follow TRAI May-2025 mapping', () => {
  assert.equal(DLT_CATEGORY_SUFFIX.promotional, 'P');
  assert.equal(DLT_CATEGORY_SUFFIX.service_explicit, 'S');
  assert.equal(DLT_CATEGORY_SUFFIX.service_implicit, 'S');
  assert.equal(DLT_CATEGORY_SUFFIX.transactional, 'T');
  assert.equal(DLT_CATEGORY_SUFFIX.government, 'G');
});

// ─── Template wire round-trip (dlt_store.rs::template_from_doc) ──────────

test('template input parses to the exact wire shape the engine reads', () => {
  // Mirrors `template_from_doc_parses_wire_shape` in dlt_store.rs.
  const parsed = dltTemplateInputSchema.parse({
    templateId: ' 1107001 ',
    headerIds: ['H1', ' H2 '],
    category: 'Promotional',
    body: 'Get {#var#}% off!',
    peId: 'PE9',
    status: 'active',
  });
  assert.deepEqual(parsed, {
    templateId: '1107001',
    headerIds: ['H1', 'H2'],
    category: 'promotional',
    body: 'Get {#var#}% off!',
    peId: 'PE9',
    status: 'active',
  });
});

test('template input defaults optional fields like the engine tolerates', () => {
  const parsed = dltTemplateInputSchema.parse({
    templateId: 'T1',
    body: 'Hello world',
    category: 'txn',
  });
  assert.equal(parsed.category, 'transactional');
  assert.equal(parsed.peId, '');
  assert.deepEqual(parsed.headerIds, []);
  assert.equal(parsed.status, 'active');
});

test('template input rejects what template_from_doc would reject', () => {
  // Blank templateId.
  assert.equal(
    dltTemplateInputSchema.safeParse({ templateId: ' ', body: 'x', category: 'promotional' }).success,
    false,
  );
  // Unknown category.
  assert.equal(
    dltTemplateInputSchema.safeParse({ templateId: 'T1', body: 'x', category: 'nope' }).success,
    false,
  );
  // Empty body (the engine treats it as "", but the UI requires one).
  assert.equal(
    dltTemplateInputSchema.safeParse({ templateId: 'T1', body: '  ', category: 'promotional' }).success,
    false,
  );
});

// ─── Header wire round-trip (dlt_store.rs::header_from_doc) ───────────────

test('header input parses to the wire shape', () => {
  const parsed = dltHeaderInputSchema.parse({
    headerId: 'H1',
    header: ' SABOTP ',
    category: 'Service Implicit',
  });
  assert.deepEqual(parsed, {
    headerId: 'H1',
    header: 'SABOTP',
    category: 'service_implicit',
  });
});

test('header input rejects blank header / headerId', () => {
  assert.equal(
    dltHeaderInputSchema.safeParse({ headerId: '', header: 'SABOTP', category: 't' }).success,
    false,
  );
  assert.equal(
    dltHeaderInputSchema.safeParse({ headerId: 'H1', header: '   ', category: 't' }).success,
    false,
  );
});

// ─── Entity ───────────────────────────────────────────────────────────────

test('entity input trims and defaults', () => {
  const parsed = dltEntityInputSchema.parse({ peId: ' PE9 ', name: ' Acme ' });
  assert.deepEqual(parsed, { peId: 'PE9', name: 'Acme', status: 'active' });
});

test('entity input rejects blank peId and bad status', () => {
  assert.equal(dltEntityInputSchema.safeParse({ peId: '  ', name: 'x' }).success, false);
  assert.equal(
    dltEntityInputSchema.safeParse({ peId: 'PE9', name: '', status: 'paused' }).success,
    false,
  );
});

// ─── Chain (dlt_store.rs::chain_from_doc + TRAI cap) ──────────────────────

test('chain input parses to the wire shape', () => {
  // Mirrors `chain_from_doc_parses` in dlt_store.rs.
  const parsed = dltChainInputSchema.parse({ peId: 'PE9', tmIds: ['TM1'] });
  assert.deepEqual(parsed, { peId: 'PE9', tmIds: ['TM1'] });
});

test('chain caps tmIds at 2 (TRAI) and requires peId', () => {
  assert.equal(
    dltChainInputSchema.safeParse({ peId: 'PE9', tmIds: ['TM1', 'TM2'] }).success,
    true,
  );
  assert.equal(
    dltChainInputSchema.safeParse({ peId: 'PE9', tmIds: ['TM1', 'TM2', 'TM3'] }).success,
    false,
  );
  assert.equal(dltChainInputSchema.safeParse({ peId: '', tmIds: [] }).success, false);
});

test('chain tmIds default to empty', () => {
  assert.deepEqual(dltChainInputSchema.parse({ peId: 'PE9' }).tmIds, []);
});
