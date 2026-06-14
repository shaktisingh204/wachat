/**
 * Unit tests for the quotation → CPQ-pricing line mapper (PURE logic).
 *
 * Run: npx tsx --test src/app/sabcrm/finance/quotations/quote-pricing-map.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  docLineToQuoteLine,
  docLinesToQuoteLines,
  buildQuoteForPricing,
  hasPriceableLines,
} from './quote-pricing-map';
import type { DocLineDraft } from '../_components/doc-surface';

function draft(over: Partial<DocLineDraft>): DocLineDraft {
  return {
    rowId: over.rowId ?? 'r1',
    itemId: over.itemId,
    itemLabel: over.itemLabel,
    description: over.description,
    hsnSac: over.hsnSac,
    qty: over.qty ?? 0,
    unit: over.unit,
    rate: over.rate ?? 0,
    discountPct: over.discountPct,
    taxRatePct: over.taxRatePct,
  };
}

/* ─── docLineToQuoteLine ──────────────────────────────────────── */

test('docLineToQuoteLine carries the pricing-relevant fields + label', () => {
  const out = docLineToQuoteLine(
    draft({
      itemId: 'abc',
      itemLabel: 'Widget',
      description: 'A widget',
      hsnSac: '8471',
      qty: 5,
      unit: 'pcs',
      rate: 100,
      discountPct: 10,
      taxRatePct: 18,
    }),
  );
  assert.deepEqual(out, {
    itemId: 'abc',
    description: 'A widget',
    hsnSac: '8471',
    qty: 5,
    unit: 'pcs',
    rate: 100,
    discountPct: 10,
    taxRatePct: 18,
    itemLabel: 'Widget',
  });
});

test('docLineToQuoteLine: empty itemId/itemLabel normalise to undefined', () => {
  const out = docLineToQuoteLine(draft({ itemId: '', itemLabel: null, rate: 50 }));
  assert.equal(out.itemId, undefined);
  assert.equal(out.itemLabel, undefined);
  assert.equal(out.rate, 50);
});

test('docLineToQuoteLine drops the kit-internal rowId', () => {
  const out = docLineToQuoteLine(draft({ rowId: 'seed-7', rate: 10 }));
  assert.ok(!('rowId' in out));
});

/* ─── docLinesToQuoteLines (blank-row filtering) ──────────────── */

test('docLinesToQuoteLines drops blank rows (no item, no desc, rate 0)', () => {
  const lines = [
    draft({ rowId: 'a', itemId: 'x', qty: 1, rate: 100 }),
    draft({ rowId: 'b' }), // fully blank
    draft({ rowId: 'c', description: 'Service', qty: 1, rate: 200 }),
  ];
  const out = docLinesToQuoteLines(lines);
  assert.equal(out.length, 2);
  assert.equal(out[0].itemId, 'x');
  assert.equal(out[1].description, 'Service');
});

test('docLinesToQuoteLines: a row with only a rate is NOT blank', () => {
  // isBlankDocLine requires rate === 0 too, so a typed rate keeps the row.
  const out = docLinesToQuoteLines([draft({ rowId: 'a', rate: 99 })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].rate, 99);
});

test('docLinesToQuoteLines handles null/undefined input safely', () => {
  assert.deepEqual(docLinesToQuoteLines(undefined as unknown as DocLineDraft[]), []);
  assert.deepEqual(docLinesToQuoteLines([]), []);
});

/* ─── buildQuoteForPricing ────────────────────────────────────── */

test('buildQuoteForPricing wraps the mapped lines into a QuoteForPricing', () => {
  const q = buildQuoteForPricing([
    draft({ rowId: 'a', itemId: 'x', qty: 2, rate: 100 }),
    draft({ rowId: 'b' }),
  ]);
  assert.equal(q.lines.length, 1);
  assert.equal(q.lines[0].itemId, 'x');
  // No price book / rules are forced by the mapper (server resolves the book).
  assert.equal(q.priceBookId, undefined);
  assert.equal(q.rules, undefined);
});

/* ─── hasPriceableLines ───────────────────────────────────────── */

test('hasPriceableLines is true iff a non-blank row exists', () => {
  assert.equal(hasPriceableLines([draft({ rowId: 'a' })]), false);
  assert.equal(hasPriceableLines([draft({ rowId: 'a', itemId: 'x', rate: 5 })]), true);
  assert.equal(
    hasPriceableLines([draft({ rowId: 'a' }), draft({ rowId: 'b', description: 'X', rate: 1 })]),
    true,
  );
  assert.equal(hasPriceableLines([]), false);
  assert.equal(hasPriceableLines(undefined as unknown as DocLineDraft[]), false);
});
