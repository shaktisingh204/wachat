/**
 * Unit tests for `src/lib/india-tax/msme-45-day.ts`.
 *
 *   npx tsx --test src/lib/india-tax/__tests__/msme-45-day.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    AT_RISK_WINDOW_DAYS,
    DEFAULT_MSME_PAYMENT_TERMS_DAYS,
    amountOutstandingOf,
    computeMsmeOverdueFromSnapshot,
    daysOverdueAgainstMsmeClock,
    isValidUdyamRegistrationNumber,
    validateMsmeVendorRegistration,
    type RawBill,
    type RawVendor,
} from '../msme-45-day';

/** Build a vendor doc for the snapshot tests. */
function vendor(over: Partial<RawVendor> = {}): RawVendor {
    return {
        _id: over._id ?? 'v1',
        name: over.name ?? 'Acme Micro Pvt Ltd',
        isMsme: over.isMsme ?? true,
        msmeCategory: over.msmeCategory ?? 'Micro',
        udyamRegistrationNumber: over.udyamRegistrationNumber ?? 'UDYAM-MH-12-1234567',
        msmePaymentTermsDays: over.msmePaymentTermsDays,
    };
}

/** Build a bill doc for the snapshot tests. */
function bill(over: Partial<RawBill> = {}): RawBill {
    return {
        _id: over._id ?? 'b1',
        vendorId: over.vendorId ?? 'v1',
        billNo: over.billNo ?? 'BILL-1',
        billDate: over.billDate ?? new Date('2026-01-01T00:00:00Z'),
        status: over.status ?? 'submitted',
        totals: over.totals ?? { total: 10000 },
        amountPaid: over.amountPaid,
        balance: over.balance,
    };
}

const FIXED_NOW = new Date('2026-05-18T06:00:00Z');

/* ─── 1. No MSME vendors → empty result ─────────────────────────── */

test('returns empty result when there are no MSME-registered vendors', () => {
    // Two non-MSME vendors. We hand-build them to bypass the
    // factory's default of `isMsme: true`.
    const vendorsById = new Map<string, RawVendor>([
        ['v1', { _id: 'v1', name: 'Plain Vendor A', isMsme: false }],
        ['v2', { _id: 'v2', name: 'Plain Vendor B' /* isMsme undefined */ }],
    ]);
    const bills = [
        bill({ vendorId: 'v1', billDate: new Date('2026-01-01T00:00:00Z') }),
        bill({ _id: 'b2', vendorId: 'v2', billDate: new Date('2025-12-01T00:00:00Z') }),
    ];

    const out = computeMsmeOverdueFromSnapshot(bills, vendorsById, FIXED_NOW);

    assert.equal(out.bills.length, 0);
    assert.deepEqual(out.summary, {
        totalOverdueCount: 0,
        totalOverdueAmount: 0,
        totalAtRiskCount: 0,
        totalAtRiskAmount: 0,
    });
});

/* ─── 2. Bill well within 45 days → not flagged ─────────────────── */

test('bill within 45 days (and outside at-risk window) is not flagged', () => {
    // Bill 10 days old, terms 45 → daysOverdue = 10 - 45 = -35, well outside
    // the at-risk window (-7).
    const billDate = new Date(FIXED_NOW.getTime() - 10 * 24 * 60 * 60 * 1000);
    const vendorsById = new Map([['v1', vendor()]]);
    const bills = [bill({ billDate })];

    const out = computeMsmeOverdueFromSnapshot(bills, vendorsById, FIXED_NOW);

    assert.equal(out.bills.length, 0);
    assert.equal(out.summary.totalOverdueCount, 0);
    assert.equal(out.summary.totalAtRiskCount, 0);
});

/* ─── 3. Bill exactly at 45 days → at-risk (daysOverdue === 0) ──── */

test('bill exactly at the 45-day boundary surfaces as at-risk (daysOverdue=0)', () => {
    const billDate = new Date(
        FIXED_NOW.getTime() - DEFAULT_MSME_PAYMENT_TERMS_DAYS * 24 * 60 * 60 * 1000,
    );
    const vendorsById = new Map([['v1', vendor()]]);
    const bills = [bill({ billDate, totals: { total: 25000 } })];

    const out = computeMsmeOverdueFromSnapshot(bills, vendorsById, FIXED_NOW);

    assert.equal(out.bills.length, 1);
    assert.equal(out.bills[0].daysOverdue, 0);
    assert.equal(out.bills[0].bucket, 'at_risk');
    assert.equal(out.summary.totalAtRiskCount, 1);
    assert.equal(out.summary.totalAtRiskAmount, 25000);
    assert.equal(out.summary.totalOverdueCount, 0);
});

/* ─── 4. Overdue by 10 days → flagged 'overdue' ─────────────────── */

test('bill overdue by 10 days surfaces as overdue with correct daysOverdue + amount', () => {
    const billDate = new Date(
        FIXED_NOW.getTime() - (DEFAULT_MSME_PAYMENT_TERMS_DAYS + 10) * 24 * 60 * 60 * 1000,
    );
    const vendorsById = new Map([['v1', vendor()]]);
    const bills = [
        bill({
            billDate,
            totals: { total: 75000 },
            amountPaid: 25000, // → outstanding 50000
            status: 'partially_paid',
        }),
    ];

    const out = computeMsmeOverdueFromSnapshot(bills, vendorsById, FIXED_NOW);

    assert.equal(out.bills.length, 1);
    const row = out.bills[0];
    assert.equal(row.daysOverdue, 10);
    assert.equal(row.bucket, 'overdue');
    assert.equal(row.amountOutstanding, 50000);
    assert.equal(row.msmePaymentTermsDays, DEFAULT_MSME_PAYMENT_TERMS_DAYS);
    assert.deepEqual(out.summary, {
        totalOverdueCount: 1,
        totalOverdueAmount: 50000,
        totalAtRiskCount: 0,
        totalAtRiskAmount: 0,
    });
});

/* ─── 5. Custom 30-day payment terms → boundary respected ───────── */

test('custom 30-day payment terms compute overdue against 30 days, not 45', () => {
    // Vendor on a 30-day agreement, bill is 40 days old → overdue by 10
    // days. Same age against the default 45-day clock would be only
    // at-risk (daysOverdue=-5), so this proves the per-vendor override
    // routes correctly.
    const billDate = new Date(FIXED_NOW.getTime() - 40 * 24 * 60 * 60 * 1000);
    const vendorsById = new Map([
        ['v1', vendor({ msmePaymentTermsDays: 30 })],
    ]);
    const bills = [bill({ billDate, totals: { total: 12000 } })];

    const out = computeMsmeOverdueFromSnapshot(bills, vendorsById, FIXED_NOW);

    assert.equal(out.bills.length, 1);
    assert.equal(out.bills[0].daysOverdue, 10);
    assert.equal(out.bills[0].bucket, 'overdue');
    assert.equal(out.bills[0].msmePaymentTermsDays, 30);
    assert.equal(out.summary.totalOverdueCount, 1);
    assert.equal(out.summary.totalOverdueAmount, 12000);
});

/* ─── Sanity tests on pure helpers ──────────────────────────────── */

test('daysOverdueAgainstMsmeClock matches the documented formula', () => {
    const now = new Date('2026-05-18T00:00:00Z');
    const billDate = new Date('2026-03-01T00:00:00Z'); // 78 days old
    assert.equal(daysOverdueAgainstMsmeClock(billDate, now, 45), 78 - 45);
});

test('amountOutstandingOf prefers balance, then totals - paid, then total', () => {
    assert.equal(amountOutstandingOf({ _id: 'x', totals: { total: 100 }, balance: 60 }), 60);
    assert.equal(
        amountOutstandingOf({ _id: 'x', totals: { total: 100 }, amountPaid: 40 }),
        60,
    );
    assert.equal(amountOutstandingOf({ _id: 'x', totals: { total: 100 } }), 100);
});

test('paid/cancelled bills are excluded from the snapshot', () => {
    const billDate = new Date(FIXED_NOW.getTime() - 60 * 24 * 60 * 60 * 1000);
    const vendorsById = new Map([['v1', vendor()]]);
    const bills = [
        bill({ _id: 'paid', billDate, status: 'paid' }),
        bill({ _id: 'cancelled', billDate, status: 'cancelled' }),
        bill({ _id: 'open', billDate, status: 'submitted' }),
    ];

    const out = computeMsmeOverdueFromSnapshot(bills, vendorsById, FIXED_NOW);

    assert.equal(out.bills.length, 1);
    assert.equal(out.bills[0].billId, 'open');
});

test('Udyam validation accepts canonical form and rejects malformed ids', () => {
    assert.equal(isValidUdyamRegistrationNumber('UDYAM-MH-12-1234567'), true);
    assert.equal(isValidUdyamRegistrationNumber('udyam-mh-12-1234567'), true); // case-tolerant
    assert.equal(isValidUdyamRegistrationNumber('UDYAM-MH-12-12345'), false); // too short
    assert.equal(isValidUdyamRegistrationNumber(''), false);
    assert.equal(isValidUdyamRegistrationNumber(undefined), false);

    assert.equal(validateMsmeVendorRegistration({ isMsme: false }), null);
    assert.equal(
        validateMsmeVendorRegistration({
            isMsme: true,
            udyamRegistrationNumber: 'UDYAM-MH-12-1234567',
        }),
        null,
    );
    assert.notEqual(validateMsmeVendorRegistration({ isMsme: true }), null);
    assert.notEqual(
        validateMsmeVendorRegistration({ isMsme: true, udyamRegistrationNumber: 'bad' }),
        null,
    );
});

test('at-risk window threshold is exactly 7 days', () => {
    // 7 days before the boundary → still flagged.
    const billDateSeven = new Date(
        FIXED_NOW.getTime() -
            (DEFAULT_MSME_PAYMENT_TERMS_DAYS - (AT_RISK_WINDOW_DAYS - 1)) *
                24 *
                60 *
                60 *
                1000,
    );
    // 8 days before the boundary → not flagged.
    const billDateEight = new Date(
        FIXED_NOW.getTime() -
            (DEFAULT_MSME_PAYMENT_TERMS_DAYS - AT_RISK_WINDOW_DAYS) * 24 * 60 * 60 * 1000,
    );
    const vendorsById = new Map([['v1', vendor()]]);

    const out1 = computeMsmeOverdueFromSnapshot([bill({ billDate: billDateSeven })], vendorsById, FIXED_NOW);
    assert.equal(out1.bills.length, 1);
    assert.equal(out1.bills[0].bucket, 'at_risk');

    const out2 = computeMsmeOverdueFromSnapshot([bill({ _id: 'b2', billDate: billDateEight })], vendorsById, FIXED_NOW);
    assert.equal(out2.bills.length, 0);
});
