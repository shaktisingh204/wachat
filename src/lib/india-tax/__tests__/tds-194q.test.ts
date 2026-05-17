/**
 * Pure unit tests for `src/lib/india-tax/tds-194q.ts` — exercises
 * the pure helpers that don't touch Mongo. `recordTds194qDeduction`
 * isn't unit-tested here because it requires a live `connectToDatabase`;
 * its math is implicitly covered by `applyVendorRule`.
 *
 *   npx tsx --test src/lib/india-tax/__tests__/tds-194q.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    aggregateVendorPurchases,
    applyVendorRule,
    evaluateApplicabilityFromTotals,
    previousFy,
    TDS_194Q_RATE,
    TURNOVER_THRESHOLD_INR,
    VENDOR_THRESHOLD_INR,
} from '../tds-194q';

test('previousFy: shifts both halves of the FY string back by one year', () => {
    assert.equal(previousFy('2026-27'), '2025-26');
    assert.equal(previousFy('2020-21'), '2019-20');
});

test('evaluateApplicabilityFromTotals: prior-year turnover below threshold', () => {
    const r = evaluateApplicabilityFromTotals(5_00_00_000, '2026-27'); // ₹5 cr
    assert.equal(r.applicable, false);
    assert.equal(r.threshold, TURNOVER_THRESHOLD_INR);
    assert.equal(r.priorFinancialYear, '2025-26');
    assert.match(r.reason, /does not apply/i);
});

test('evaluateApplicabilityFromTotals: turnover above threshold flips applicable', () => {
    const r = evaluateApplicabilityFromTotals(12_00_00_000, '2026-27'); // ₹12 cr
    assert.equal(r.applicable, true);
    assert.equal(r.priorYearTurnover, 12_00_00_000);
    assert.match(r.reason, /applies/i);
});

test('applyVendorRule: vendor below ₹50L threshold yields zero deductible', () => {
    const row = applyVendorRule({
        vendorId: 'v1',
        vendorName: 'Below',
        gstin: '29X',
        totalPurchases: 30_00_000, // ₹30L
        tdsAlreadyDeducted: 0,
    });
    assert.equal(row.deductibleAmount, 0);
    assert.equal(row.tdsToDeduct, 0);
    assert.equal(row.status, 'threshold_not_crossed');
});

test('applyVendorRule: deductible amount + status math at + above ₹50L', () => {
    // ₹75L total → deductible ₹25L → TDS 0.1% = ₹2,500.
    const row = applyVendorRule({
        vendorId: 'v2',
        vendorName: 'Above',
        gstin: '29Y',
        totalPurchases: 75_00_000,
        tdsAlreadyDeducted: 0,
    });
    assert.equal(row.deductibleAmount, 25_00_000);
    assert.equal(row.tdsToDeduct, 25_00_000 * TDS_194Q_RATE);
    assert.equal(row.tdsToDeduct, 2_500);
    assert.equal(row.status, 'deduct_on_next_bill');

    // After full deduction → status flips to 'deducted'.
    const recorded = applyVendorRule({
        vendorId: 'v2',
        vendorName: 'Above',
        gstin: '29Y',
        totalPurchases: 75_00_000,
        tdsAlreadyDeducted: 2_500,
    });
    assert.equal(recorded.status, 'deducted');
});

test('aggregateVendorPurchases: sorts by descending purchases and uses VENDOR_THRESHOLD_INR const', () => {
    // Sanity-check the threshold constant first — it's the load-bearing
    // ₹50 lakh number from the spec.
    assert.equal(VENDOR_THRESHOLD_INR, 50_00_000);

    const out = aggregateVendorPurchases(
        [
            {
                vendorId: 'small',
                vendorName: 'Small',
                gstin: null,
                totalPurchases: 10_00_000,
                tdsAlreadyDeducted: 0,
            },
            {
                vendorId: 'big',
                vendorName: 'Big',
                gstin: '29BIG',
                totalPurchases: 1_20_00_000, // ₹1.2 cr
                tdsAlreadyDeducted: 0,
            },
            {
                vendorId: 'mid',
                vendorName: 'Mid',
                gstin: null,
                totalPurchases: 60_00_000,
                tdsAlreadyDeducted: 0,
            },
        ],
        '2026-27',
    );

    assert.equal(out.financialYear, '2026-27');
    assert.equal(out.byVendor.length, 3);
    // Big > Mid > Small by purchases.
    assert.equal(out.byVendor[0].vendorName, 'Big');
    assert.equal(out.byVendor[1].vendorName, 'Mid');
    assert.equal(out.byVendor[2].vendorName, 'Small');
    // Big: ₹1.2 cr - ₹50 L = ₹70 L deductible → ₹7,000 TDS.
    assert.equal(out.byVendor[0].deductibleAmount, 70_00_000);
    assert.equal(out.byVendor[0].tdsToDeduct, 7_000);
    // Mid: ₹60L - ₹50L = ₹10L deductible → ₹1,000 TDS.
    assert.equal(out.byVendor[1].deductibleAmount, 10_00_000);
    assert.equal(out.byVendor[1].tdsToDeduct, 1_000);
    // Small: below threshold.
    assert.equal(out.byVendor[2].deductibleAmount, 0);
    assert.equal(out.byVendor[2].status, 'threshold_not_crossed');
});
