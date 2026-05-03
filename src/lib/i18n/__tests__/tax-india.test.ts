/**
 * India GST tests.
 *
 * Run via:
 *   npx tsx --test src/lib/i18n/__tests__/tax-india.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { calculateTax, rulesForCountry } from '../tax';

test('IN inter-state (no sub-region) → IGST 18% by default for SaaS', () => {
    const r = calculateTax({
        amount: 1000,
        region: 'IN',
        productType: 'saas_subscription',
        customerType: 'b2b',
    });
    assert.equal(r.kind, 'gst');
    assert.equal(r.rate, 0.18);
    assert.equal(r.tax, 180);
    assert.equal(r.gross, 1180);
    assert.equal(r.breakdown.length, 1);
    assert.equal(r.breakdown[0].label, 'IGST');
});

test('IN intra-state (with sub-region) → splits CGST + SGST', () => {
    const r = calculateTax({
        amount: 1000,
        region: 'IN-MH',
        productType: 'saas_subscription',
        customerType: 'b2c',
    });
    assert.equal(r.kind, 'gst');
    assert.equal(r.tax, 180);
    assert.equal(r.breakdown.length, 2);
    const labels = r.breakdown.map((b) => b.label).sort();
    assert.deepEqual(labels, ['CGST', 'SGST']);
    // CGST + SGST should sum to total tax (within rounding).
    const sum = r.breakdown.reduce((a, b) => a + b.amount, 0);
    assert.ok(Math.abs(sum - r.tax) < 0.01);
});

test('IN gstSlab override applies the requested slab', () => {
    const r28 = calculateTax({
        amount: 1000,
        region: 'IN',
        productType: 'physical_good',
        customerType: 'b2c',
        gstSlab: 28,
    });
    assert.equal(r28.rate, 0.28);
    assert.equal(r28.tax, 280);

    const r5 = calculateTax({
        amount: 1000,
        region: 'IN',
        productType: 'physical_good',
        customerType: 'b2c',
        gstSlab: 5,
    });
    assert.equal(r5.rate, 0.05);
    assert.equal(r5.tax, 50);
});

test('IN food defaults to 5% slab, education defaults to 12%', () => {
    const food = calculateTax({
        amount: 200,
        region: 'IN',
        productType: 'food',
        customerType: 'b2c',
    });
    assert.equal(food.rate, 0.05);
    assert.equal(food.tax, 10);

    const edu = calculateTax({
        amount: 200,
        region: 'IN',
        productType: 'education',
        customerType: 'b2c',
    });
    assert.equal(edu.rate, 0.12);
    assert.equal(edu.tax, 24);
});

test('rulesForCountry("IN") returns all four GST slabs', () => {
    const rules = rulesForCountry('IN');
    assert.equal(rules.length, 4);
    const rates = rules.map((r) => r.rate).sort((a, b) => a - b);
    assert.deepEqual(rates, [0.05, 0.12, 0.18, 0.28]);
});

test('IN rejects negative amounts', () => {
    assert.throws(
        () =>
            calculateTax({
                amount: -10,
                region: 'IN',
                productType: 'saas_subscription',
                customerType: 'b2c',
            }),
        /amount must be >= 0/,
    );
});

test('EU B2B with VAT ID triggers reverse-charge (zero tax)', () => {
    const r = calculateTax({
        amount: 1000,
        region: 'DE',
        productType: 'saas_subscription',
        customerType: 'b2b_with_vat_id',
    });
    assert.equal(r.tax, 0);
    assert.equal(r.gross, 1000);
    assert.equal(r.reverseCharge, true);
    assert.equal(r.kind, 'vat');
});
