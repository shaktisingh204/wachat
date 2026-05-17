/**
 * Unit tests for the GSTR-1 generator
 * (`src/lib/reports/india/gstr1.ts`, §6.10).
 *
 *   npx tsx --test src/lib/reports/india/__tests__/gstr1.test.ts
 *
 * Drives the pure `buildGstr1Sections` builder against deterministic
 * fixtures — no Mongo, no fs, no network.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    B2CL_THRESHOLD,
    buildGstr1Sections,
    projectGstr1ToGstnJson,
    type SourceInvoiceDoc,
    type SourceCreditNoteDoc,
} from '../gstr1';

/* ─── Fixtures ───────────────────────────────────────────────────────── */

function inv(partial: Partial<SourceInvoiceDoc>): SourceInvoiceDoc {
    return {
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2026-04-15T00:00:00Z'),
        total: 1000,
        ...partial,
    };
}

function cn(partial: Partial<SourceCreditNoteDoc>): SourceCreditNoteDoc {
    return {
        creditNoteNumber: 'CN-001',
        creditNoteDate: new Date('2026-04-20T00:00:00Z'),
        total: 500,
        ...partial,
    };
}

/* ─── 1. B2B classification ──────────────────────────────────────────── */

test('B2B classification: buyer GSTIN routes to b2b section', () => {
    const invoices: SourceInvoiceDoc[] = [
        inv({
            invoiceNumber: 'INV-2026-0001',
            buyerGstin: '27AAAAA0000A1Z5',
            sellerStateCode: '27',
            placeOfSupply: '27',
            total: 11800,
            lineItems: [
                { quantity: 10, rate: 1000, hsnCode: '8523', taxRate: 18, uqc: 'NOS' },
            ],
        }),
    ];
    const result = buildGstr1Sections(invoices, []);
    assert.equal(result.b2b.length, 1, 'one B2B invoice');
    assert.equal(result.b2cl.length, 0);
    assert.equal(result.b2cs.length, 0);
    const r = result.b2b[0];
    assert.equal(r.gstin, '27AAAAA0000A1Z5');
    assert.equal(r.invoiceNumber, 'INV-2026-0001');
    assert.equal(r.placeOfSupply, '27');
    assert.equal(r.reverseCharge, 'N');
    assert.equal(r.invoiceType, 'R');
    // Intra-state (seller 27 == buyer 27) ⇒ CGST + SGST, no IGST.
    const item = r.items[0];
    assert.equal(item.rate, 18);
    assert.equal(item.taxableValue, 10000);
    assert.equal(item.igst, 0);
    assert.equal(item.cgst, 900);
    assert.equal(item.sgst, 900);
});

/* ─── 2. B2CL threshold ──────────────────────────────────────────────── */

test('B2CL threshold: unregistered inter-state >₹2.5L goes to b2cl', () => {
    const above = inv({
        invoiceNumber: 'INV-002',
        sellerStateCode: '27',
        buyerStateCode: '29',
        placeOfSupply: '29',
        total: B2CL_THRESHOLD + 1, // 250001
        lineItems: [
            { quantity: 1, rate: B2CL_THRESHOLD + 1, hsnCode: '8523', taxRate: 18 },
        ],
    });
    const below = inv({
        invoiceNumber: 'INV-003',
        sellerStateCode: '27',
        buyerStateCode: '29',
        placeOfSupply: '29',
        total: B2CL_THRESHOLD, // 250000 exactly — boundary, NOT B2CL.
        lineItems: [
            { quantity: 1, rate: B2CL_THRESHOLD, hsnCode: '8523', taxRate: 18 },
        ],
    });
    const result = buildGstr1Sections([above, below], []);

    assert.equal(result.b2cl.length, 1, 'one B2CL invoice (above threshold)');
    const r = result.b2cl[0];
    assert.equal(r.invoiceNumber, 'INV-002');
    assert.equal(r.placeOfSupply, '29');
    // Inter-state ⇒ IGST only.
    const it = r.items[0];
    assert.equal(it.igst, ((B2CL_THRESHOLD + 1) * 18) / 100);
    assert.equal(it.cgst, 0);
    assert.equal(it.sgst, 0);

    // The "exactly threshold" doc falls into B2CS.
    assert.equal(result.b2cs.length, 1);
    assert.equal(result.b2cs[0].placeOfSupply, '29');
});

/* ─── 3. B2CS state grouping ─────────────────────────────────────────── */

test('B2CS grouping: aggregates by place-of-supply × rate', () => {
    const docs: SourceInvoiceDoc[] = [
        inv({
            invoiceNumber: 'INV-004',
            sellerStateCode: '27',
            buyerStateCode: '29',
            placeOfSupply: '29',
            total: 1000,
            lineItems: [{ quantity: 1, rate: 1000, hsnCode: '6101', taxRate: 5 }],
        }),
        inv({
            invoiceNumber: 'INV-005',
            sellerStateCode: '27',
            buyerStateCode: '29',
            placeOfSupply: '29',
            total: 2000,
            lineItems: [{ quantity: 1, rate: 2000, hsnCode: '6101', taxRate: 5 }],
        }),
        inv({
            invoiceNumber: 'INV-006',
            sellerStateCode: '27',
            buyerStateCode: '29',
            placeOfSupply: '29',
            total: 500,
            lineItems: [{ quantity: 1, rate: 500, hsnCode: '8523', taxRate: 18 }],
        }),
        inv({
            invoiceNumber: 'INV-007',
            sellerStateCode: '27',
            buyerStateCode: '07',
            placeOfSupply: '07',
            total: 1000,
            lineItems: [{ quantity: 1, rate: 1000, hsnCode: '6101', taxRate: 5 }],
        }),
    ];
    const result = buildGstr1Sections(docs, []);
    assert.equal(result.b2cs.length, 3, '3 (state × rate) buckets');

    const byKey = Object.fromEntries(
        result.b2cs.map((r) => [`${r.placeOfSupply}|${r.rate}`, r]),
    );
    // 29 @ 5%: 1000 + 2000 = 3000 taxable, IGST 150.
    assert.equal(byKey['29|5'].taxableValue, 3000);
    assert.equal(byKey['29|5'].igst, 150);
    assert.equal(byKey['29|5'].supplyType, 'INTER');
    // 29 @ 18%: 500 taxable, IGST 90.
    assert.equal(byKey['29|18'].taxableValue, 500);
    assert.equal(byKey['29|18'].igst, 90);
    // 07 @ 5%: 1000 taxable, IGST 50.
    assert.equal(byKey['07|5'].taxableValue, 1000);
    assert.equal(byKey['07|5'].igst, 50);
});

/* ─── 4. HSN summary aggregation ─────────────────────────────────────── */

test('HSN summary: aggregates qty + heads per (hsn × uqc × rate)', () => {
    const docs: SourceInvoiceDoc[] = [
        inv({
            invoiceNumber: 'INV-008',
            buyerGstin: '27AAAAA0000A1Z5',
            sellerStateCode: '27',
            placeOfSupply: '27',
            total: 11800,
            lineItems: [
                { quantity: 10, rate: 1000, hsnCode: '8523', taxRate: 18, uqc: 'NOS' },
                { quantity: 5, rate: 1000, hsnCode: '8523', taxRate: 18, uqc: 'NOS' },
                { quantity: 2, rate: 500, hsnCode: '6101', taxRate: 5, uqc: 'NOS' },
            ],
        }),
        inv({
            invoiceNumber: 'INV-009',
            buyerGstin: '27AAAAA0000A1Z5',
            sellerStateCode: '27',
            placeOfSupply: '27',
            total: 5900,
            lineItems: [
                { quantity: 3, rate: 1000, hsnCode: '8523', taxRate: 18, uqc: 'NOS' },
            ],
        }),
    ];
    const result = buildGstr1Sections(docs, []);
    assert.equal(result.hsn.length, 2, '2 HSN buckets');

    const byKey = Object.fromEntries(result.hsn.map((h) => [h.hsnCode, h]));
    // 8523: 10+5+3 = 18 qty, taxable 10000+5000+3000 = 18000, intra ⇒ cgst+sgst 9% each.
    assert.equal(byKey['8523'].totalQuantity, 18);
    assert.equal(byKey['8523'].taxableValue, 18000);
    assert.equal(byKey['8523'].cgst, 1620);
    assert.equal(byKey['8523'].sgst, 1620);
    assert.equal(byKey['8523'].igst, 0);
    // 6101 @ 5%: qty 2, taxable 1000, cgst/sgst 25 each.
    assert.equal(byKey['6101'].totalQuantity, 2);
    assert.equal(byKey['6101'].taxableValue, 1000);
    assert.equal(byKey['6101'].cgst, 25);
    assert.equal(byKey['6101'].sgst, 25);
});

/* ─── 5. Credit-note handling ────────────────────────────────────────── */

test('credit notes: routed to CDNR with negative-friendly heads + JSON projection', () => {
    const invoices: SourceInvoiceDoc[] = [
        inv({
            invoiceNumber: 'INV-010',
            buyerGstin: '27AAAAA0000A1Z5',
            sellerStateCode: '27',
            placeOfSupply: '27',
            total: 11800,
            lineItems: [
                { quantity: 10, rate: 1000, hsnCode: '8523', taxRate: 18, uqc: 'NOS' },
            ],
        }),
    ];
    const creditNotes: SourceCreditNoteDoc[] = [
        cn({
            creditNoteNumber: 'CN-2026-0001',
            originalInvoiceNumber: 'INV-010',
            buyerGstin: '27AAAAA0000A1Z5',
            sellerStateCode: '27',
            placeOfSupply: '27',
            total: 1180,
            lineItems: [{ quantity: 1, rate: 1000, hsnCode: '8523', taxRate: 18 }],
        }),
    ];
    const result = buildGstr1Sections(invoices, creditNotes);
    assert.equal(result.cdnr.length, 1);
    const note = result.cdnr[0];
    assert.equal(note.noteNumber, 'CN-2026-0001');
    assert.equal(note.noteType, 'C');
    assert.equal(note.gstin, '27AAAAA0000A1Z5');
    assert.equal(note.originalInvoiceNumber, 'INV-010');
    assert.equal(note.items[0].taxableValue, 1000);
    assert.equal(note.items[0].cgst, 90);
    assert.equal(note.items[0].sgst, 90);

    // documentsIssued must include both INV and CN series.
    const types = result.docIssue.map((d) => d.docType).sort();
    assert.deepEqual(types, ['CN', 'INV']);

    // GSTN JSON projection emits a CDNR block grouped by ctin.
    const json = projectGstr1ToGstnJson(result, {
        gstin: '27SELLERAAAA1Z5',
        period: { month: 4, year: 2026 },
    }) as any;
    assert.equal(json.fp, '042026');
    assert.equal(Array.isArray(json.cdnr), true);
    assert.equal(json.cdnr[0].ctin, '27AAAAA0000A1Z5');
    assert.equal(json.cdnr[0].nt[0].ntty, 'C');
});
