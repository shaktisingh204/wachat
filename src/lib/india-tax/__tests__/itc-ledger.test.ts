/**
 * Pure unit tests for `src/lib/india-tax/itc-ledger.ts` —
 * exercises `aggregateBookItc` + `reconcileItc`, the pure entry
 * points. No Mongo, no `connectToDatabase()`.
 *
 *   npx tsx --test src/lib/india-tax/__tests__/itc-ledger.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    aggregateBookItc,
    reconcileItc,
    type BillForItc,
    type Gstr2bInvoice,
} from '../itc-ledger';

function bookRow(over: {
    gstin: string | null;
    name: string;
    inv: string;
    amount: number;
    itc: number;
}) {
    return {
        supplierGstin: over.gstin,
        supplierName: over.name,
        invoiceNumber: over.inv,
        amount: over.amount,
        itc: over.itc,
    };
}

test('reconcileItc: exact invoice-number match wins over fuzzy', () => {
    const books = [
        bookRow({
            gstin: '29ABCDE1234F1Z5',
            name: 'Acme',
            inv: 'INV-001',
            amount: 11_800,
            itc: 1_800,
        }),
    ];
    const gstr2b: Gstr2bInvoice[] = [
        {
            supplierGstin: '29ABCDE1234F1Z5',
            supplierName: 'Acme',
            invoiceNumber: 'INV-001',
            totalAmount: 11_800,
            igst: 1_800,
        },
    ];
    const r = reconcileItc(books, gstr2b, '2026-04');
    assert.equal(r.matched.length, 1);
    assert.equal(r.matched[0].matchType, 'exact');
    assert.equal(r.matched[0].bookItc, 1_800);
    assert.equal(r.onlyInBooks.length, 0);
    assert.equal(r.onlyInGstr2b.length, 0);
    assert.equal(r.summary.totalMatched, 1_800);
});

test('reconcileItc: fuzzy ±5 INR amount match when invoice number drifts', () => {
    const books = [
        bookRow({
            gstin: '29ABCDE1234F1Z5',
            name: 'Acme',
            inv: 'INV-001',
            amount: 11_800,
            itc: 1_800,
        }),
    ];
    const gstr2b: Gstr2bInvoice[] = [
        {
            supplierGstin: '29ABCDE1234F1Z5',
            supplierName: 'Acme',
            invoiceNumber: 'INV001', // formatting differs
            totalAmount: 11_803, // ₹3 within ±5 tolerance
            igst: 1_800,
        },
    ];
    const r = reconcileItc(books, gstr2b, '2026-04');
    assert.equal(r.matched.length, 1);
    assert.equal(r.matched[0].matchType, 'fuzzy');
    assert.equal(r.onlyInBooks.length, 0);
    assert.equal(r.onlyInGstr2b.length, 0);

    // ₹6 diff (outside ±5) must NOT match.
    const tooFar: Gstr2bInvoice[] = [
        {
            supplierGstin: '29ABCDE1234F1Z5',
            supplierName: 'Acme',
            invoiceNumber: 'INV001',
            totalAmount: 11_806,
            igst: 1_800,
        },
    ];
    const r2 = reconcileItc(books, tooFar, '2026-04');
    assert.equal(r2.matched.length, 0);
    assert.equal(r2.onlyInBooks.length, 1);
    assert.equal(r2.onlyInGstr2b.length, 1);
});

test('reconcileItc: only-in-books detection (supplier not yet filed GSTR-1)', () => {
    const books = [
        bookRow({
            gstin: '29SUPPLIER1Z5',
            name: 'Beta',
            inv: 'B-101',
            amount: 5_900,
            itc: 900,
        }),
        bookRow({
            gstin: '29GHOST1Z5',
            name: 'Ghost',
            inv: 'G-1',
            amount: 1_180,
            itc: 180,
        }),
    ];
    const gstr2b: Gstr2bInvoice[] = [
        {
            supplierGstin: '29SUPPLIER1Z5',
            supplierName: 'Beta',
            invoiceNumber: 'B-101',
            totalAmount: 5_900,
            igst: 900,
        },
    ];
    const r = reconcileItc(books, gstr2b, '2026-04');
    assert.equal(r.matched.length, 1);
    assert.equal(r.onlyInBooks.length, 1);
    assert.equal(r.onlyInBooks[0].supplierName, 'Ghost');
    assert.equal(r.onlyInBooks[0].itc, 180);
    assert.equal(r.summary.totalOnlyInBooks, 180);
});

test('reconcileItc: only-in-2b detection (book entry missing)', () => {
    const books = [
        bookRow({
            gstin: '29ACME1Z5',
            name: 'Acme',
            inv: 'A-1',
            amount: 1_180,
            itc: 180,
        }),
    ];
    const gstr2b: Gstr2bInvoice[] = [
        {
            supplierGstin: '29ACME1Z5',
            supplierName: 'Acme',
            invoiceNumber: 'A-1',
            totalAmount: 1_180,
            igst: 180,
        },
        {
            supplierGstin: '29MYSTERY1Z5',
            supplierName: 'Mystery Co',
            invoiceNumber: 'M-99',
            totalAmount: 2_950,
            igst: 450,
        },
    ];
    const r = reconcileItc(books, gstr2b, '2026-04');
    assert.equal(r.matched.length, 1);
    assert.equal(r.onlyInGstr2b.length, 1);
    assert.equal(r.onlyInGstr2b[0].supplierName, 'Mystery Co');
    assert.equal(r.onlyInGstr2b[0].itc, 450);
    assert.equal(r.summary.totalOnlyInGstr2b, 450);
});

test('aggregateBookItc: groups by supplier and skips RCM / draft bills', () => {
    const bills: BillForItc[] = [
        {
            _id: 'b1',
            vendorId: 'v1',
            vendorName: 'Acme',
            vendorGstin: '29ACME1Z5',
            billDate: new Date('2026-04-10'),
            status: 'approved',
            items: [
                { igstAmount: 1_800, cgstAmount: 0, sgstAmount: 0, cessAmount: 0 },
            ],
        },
        {
            _id: 'b2',
            vendorId: 'v1',
            vendorName: 'Acme',
            vendorGstin: '29ACME1Z5',
            billDate: new Date('2026-04-25'),
            status: 'paid',
            items: [
                { cgstAmount: 450, sgstAmount: 450 },
            ],
        },
        {
            _id: 'b3', // RCM — excluded
            vendorId: 'v2',
            vendorName: 'RCM Co',
            vendorGstin: '29RCM1Z5',
            billDate: new Date('2026-04-15'),
            status: 'approved',
            reverseCharge: true,
            items: [{ igstAmount: 9_000 }],
        },
        {
            _id: 'b4', // draft — excluded
            vendorId: 'v3',
            vendorName: 'Draft Co',
            vendorGstin: '29DRAFT1Z5',
            billDate: new Date('2026-04-15'),
            status: 'draft',
            items: [{ igstAmount: 9_000 }],
        },
        {
            _id: 'b5', // out-of-period — excluded
            vendorId: 'v1',
            vendorName: 'Acme',
            vendorGstin: '29ACME1Z5',
            billDate: new Date('2026-03-30'),
            status: 'approved',
            items: [{ igstAmount: 5_000 }],
        },
    ];

    const r = aggregateBookItc(bills, '2026-04');
    assert.equal(r.bySupplier.length, 1);
    const row = r.bySupplier[0];
    assert.equal(row.supplierName, 'Acme');
    assert.equal(row.igst, 1_800);
    assert.equal(row.cgst, 450);
    assert.equal(row.sgst, 450);
    assert.equal(row.invoiceCount, 2);
});
