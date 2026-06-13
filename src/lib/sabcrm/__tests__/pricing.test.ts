/**
 * Unit tests for the PURE CPQ pricing waterfall (`../pricing.ts`).
 *
 * Run: `npx tsx --test src/lib/sabcrm/__tests__/pricing.test.ts`
 *
 * These cover the load-bearing math: list-price resolution (price book vs typed
 * rate), single-best volume tier (no stacking), additive manual discount, the
 * hard discount cap + its apportionment, tax on the post-discount base, the
 * applied-step trace, document rollups, and the approval gate.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  priceLine,
  priceWaterfall,
  bestVolumeTier,
  findPriceBookEntry,
  needsDiscountApproval,
  type PriceBook,
  type QuoteLineInput,
} from '../pricing';

function book(entries: PriceBook['entries']): Pick<PriceBook, 'entries'> {
  return { entries };
}

const ITEM = 'a'.repeat(24);

/* ─── list-price resolution ─────────────────────────────────────── */

test('uses price-book list price over the typed rate', () => {
  const pb = book([{ itemId: ITEM, listPrice: 100 }]);
  const line: QuoteLineInput = { itemId: ITEM, qty: 2, rate: 999 };
  const r = priceLine(line, pb);
  assert.equal(r.listPrice, 100);
  assert.equal(r.gross, 200);
  assert.equal(r.steps[0].kind, 'list');
});

test('falls back to the typed rate for a free-text row (no price book entry)', () => {
  const line: QuoteLineInput = { qty: 3, rate: 50 };
  const r = priceLine(line, null);
  assert.equal(r.listPrice, 50);
  assert.equal(r.gross, 150);
});

/* ─── volume tiers ──────────────────────────────────────────────── */

test('bestVolumeTier picks the single highest qualifying tier (no stacking)', () => {
  const tiers = [
    { minQty: 5, discountPct: 5 },
    { minQty: 10, discountPct: 10 },
    { minQty: 50, discountPct: 20 },
  ];
  assert.equal(bestVolumeTier(tiers, 3), null);
  assert.equal(bestVolumeTier(tiers, 7)?.discountPct, 5);
  assert.equal(bestVolumeTier(tiers, 12)?.discountPct, 10);
  assert.equal(bestVolumeTier(tiers, 100)?.discountPct, 20);
});

test('applies only the best volume tier, not the sum of tiers', () => {
  const pb = book([
    {
      itemId: ITEM,
      listPrice: 100,
      tiers: [
        { minQty: 5, discountPct: 5 },
        { minQty: 10, discountPct: 10 },
      ],
    },
  ]);
  const r = priceLine({ itemId: ITEM, qty: 10, rate: 0 }, pb);
  // gross 1000, 10% volume = 100 off → taxable 900, no manual, no tax
  assert.equal(r.gross, 1000);
  assert.equal(r.volumeDiscount, 100);
  assert.equal(r.discount, 100);
  assert.equal(r.taxable, 900);
  assert.equal(r.discountPct, 10);
  assert.ok(r.steps.some((s) => s.kind === 'volume'));
});

test('ignoreVolumeTiers suppresses price-book tiers', () => {
  const pb = book([
    { itemId: ITEM, listPrice: 100, tiers: [{ minQty: 1, discountPct: 50 }] },
  ]);
  const r = priceLine({ itemId: ITEM, qty: 2, rate: 0 }, pb, {
    ignoreVolumeTiers: true,
  });
  assert.equal(r.volumeDiscount, 0);
  assert.equal(r.discount, 0);
});

/* ─── manual discount (additive) + tax ──────────────────────────── */

test('manual discount stacks additively with volume, tax on post-discount base', () => {
  const pb = book([
    { itemId: ITEM, listPrice: 100, tiers: [{ minQty: 10, discountPct: 10 }] },
  ]);
  const r = priceLine(
    { itemId: ITEM, qty: 10, rate: 0, discountPct: 5, taxRatePct: 18 },
    pb,
  );
  // gross 1000; volume 10% + manual 5% = 15% → discount 150; taxable 850
  assert.equal(r.discount, 150);
  assert.equal(r.discountPct, 15);
  assert.equal(r.volumeDiscount, 100);
  assert.equal(r.manualDiscount, 50);
  assert.equal(r.taxable, 850);
  // tax 18% of 850 = 153
  assert.equal(r.tax, 153);
  assert.equal(r.total, 1003);
  assert.equal(r.steps[r.steps.length - 1].kind, 'tax');
});

/* ─── hard cap + apportionment ──────────────────────────────────── */

test('maxDiscountPct caps the combined discount and records a cap step', () => {
  const pb = book([
    { itemId: ITEM, listPrice: 100, tiers: [{ minQty: 1, discountPct: 20 }] },
  ]);
  const r = priceLine(
    { itemId: ITEM, qty: 10, rate: 0, discountPct: 20 }, // requests 40%
    pb,
    { maxDiscountPct: 25 },
  );
  // gross 1000; requested 40% but capped to 25% → discount 250
  assert.equal(r.discountPct, 25);
  assert.equal(r.discount, 250);
  // apportioned: volume 20/40 * 25 = 12.5%, manual 20/40 * 25 = 12.5%
  assert.equal(r.volumeDiscount, 125);
  assert.equal(r.manualDiscount, 125);
  assert.ok(r.steps.some((s) => s.kind === 'cap'));
});

test('discountPct never exceeds 100 even with absurd inputs', () => {
  const r = priceLine({ qty: 1, rate: 100, discountPct: 250 }, null);
  assert.equal(r.discountPct, 100);
  assert.equal(r.discount, 100);
  assert.equal(r.taxable, 0);
});

/* ─── document rollup ───────────────────────────────────────────── */

test('priceWaterfall rolls lines into totals + blended effective discount', () => {
  const pb = book([
    { itemId: ITEM, listPrice: 100, tiers: [{ minQty: 10, discountPct: 10 }] },
  ]);
  const lines: QuoteLineInput[] = [
    { itemId: ITEM, qty: 10, rate: 0, taxRatePct: 10 }, // gross 1000, disc 100
    { qty: 2, rate: 50 }, // gross 100, no disc, no tax
  ];
  const t = priceWaterfall(lines, pb);
  assert.equal(t.grossTotal, 1100);
  assert.equal(t.discountTotal, 100);
  assert.equal(t.subTotal, 1000); // 900 + 100
  assert.equal(t.taxTotal, 90); // 10% of 900
  assert.equal(t.total, 1090);
  // blended discount = 100 / 1100 = 9.09%
  assert.equal(t.effectiveDiscountPct, 9.09);
});

test('empty quote prices to all-zero totals', () => {
  const t = priceWaterfall([], null);
  assert.equal(t.grossTotal, 0);
  assert.equal(t.total, 0);
  assert.equal(t.effectiveDiscountPct, 0);
});

/* ─── findPriceBookEntry ────────────────────────────────────────── */

test('findPriceBookEntry returns null for missing item / book', () => {
  assert.equal(findPriceBookEntry(null, ITEM), null);
  assert.equal(findPriceBookEntry(book([]), undefined), null);
  assert.equal(findPriceBookEntry(book([{ itemId: ITEM, listPrice: 1 }]), 'x'), null);
  assert.ok(findPriceBookEntry(book([{ itemId: ITEM, listPrice: 1 }]), ITEM));
});

/* ─── approval gate ─────────────────────────────────────────────── */

test('needsDiscountApproval triggers above the threshold', () => {
  const d = needsDiscountApproval(
    { totals: { grossTotal: 1000, discountTotal: 200 } }, // 20%
    15,
  );
  assert.equal(d.needsApproval, true);
  assert.equal(d.effectiveDiscountPct, 20);
  assert.equal(d.thresholdPct, 15);
});

test('needsDiscountApproval is false at/below the threshold', () => {
  const at = needsDiscountApproval(
    { totals: { grossTotal: 1000, discountTotal: 150 } }, // exactly 15%
    15,
  );
  assert.equal(at.needsApproval, false);
  const below = needsDiscountApproval(
    { totals: { grossTotal: 1000, discountTotal: 100 } }, // 10%
    15,
  );
  assert.equal(below.needsApproval, false);
});

test('a non-positive threshold never requires approval', () => {
  const d = needsDiscountApproval(
    { totals: { grossTotal: 1000, discountTotal: 900 } },
    0,
  );
  assert.equal(d.needsApproval, false);
});

test('needsDiscountApproval can derive from raw lines (no price book)', () => {
  const d = needsDiscountApproval(
    { lines: [{ qty: 1, rate: 1000, discountPct: 30 }] },
    15,
  );
  assert.equal(d.effectiveDiscountPct, 30);
  assert.equal(d.needsApproval, true);
});
