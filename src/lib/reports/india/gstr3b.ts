/**
 * GSTR-3B generator — `CRM_REBUILD_PLAN.md` §6.10.
 *
 * GSTR-3B is the self-assessed monthly summary return. It rolls the
 * supplier-side numbers GSTR-1 already exposes plus the recipient-side
 * input-tax-credit derived from `crm_bills` into a one-page form with
 * nine standard sections. We do **not** auto-file — this module just
 * materialises the section totals so the page can render them and the
 * user can copy them into the GSTN portal manually.
 */

import type { Db, ObjectId } from 'mongodb';

import {
    generateGstr1,
    type SourceInvoiceDoc,
    type SourceCreditNoteDoc,
    round2,
} from './gstr1';

/* ─── DTOs ───────────────────────────────────────────────────────────── */

export interface Gstr3bOutwardSupplies {
    /** 3.1(a) — outward taxable supplies (other than zero-rated, nil, exempted). */
    taxable: TaxHeads;
    /** 3.1(b) — zero-rated outward supplies. */
    zeroRated: TaxHeads;
    /** 3.1(c) — nil-rated outward supplies. */
    nilRated: TaxHeads;
    /** 3.1(d) — exempted outward supplies. */
    exempt: TaxHeads;
    /** 3.1(e) — non-GST outward supplies. */
    nonGst: TaxHeads;
}

export interface Gstr3bItc {
    /** Total ITC available (4A). */
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    /** 4B — reversed (ineligible / blocked). */
    reversed: TaxHeads;
    /** 4D — ineligible ITC. */
    ineligible: TaxHeads;
}

export interface TaxHeads {
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
}

export interface Gstr3bReturn {
    period: { month: number; year: number };
    outwardSupplies: Gstr3bOutwardSupplies;
    /** 3.1(d) bis — inward supplies liable to reverse charge. */
    inwardSuppliesRcm: TaxHeads;
    itcClaimed: Gstr3bItc;
    /** 6.1 — payable tax after ITC offset. */
    taxLiability: TaxHeads;
    /** 5.1 / 5A — late fee (zero unless the user passes it in). */
    lateFee: { igst: number; cgst: number; sgst: number; cess: number };
}

/* ─── Bill source shape (loose) ──────────────────────────────────────── */

export interface SourceBillDoc {
    _id?: ObjectId | string;
    userId?: ObjectId | string;
    billNo?: string;
    billDate?: Date | string;
    reverseCharge?: boolean;
    status?: string;
    vendorGstin?: string;
    /** Loose total fallback. */
    total?: number;
    items?: Array<{
        qty?: number;
        rate?: number;
        total?: number;
        taxRate?: number;
        cessRate?: number;
        hsnCode?: string;
    }>;
    expenseLines?: Array<{
        amount?: number;
        taxRate?: number;
        cessRate?: number;
    }>;
    /** Pre-computed tax heads when the bill form already split them. */
    igst?: number;
    cgst?: number;
    sgst?: number;
    cess?: number;
}

/* ─── Public entry ───────────────────────────────────────────────────── */

export async function generateGstr3b(
    db: Db,
    tenantUserId: ObjectId,
    period: { month: number; year: number },
): Promise<Gstr3bReturn> {
    // Reuse GSTR-1 to get the outward-side numbers.
    const gstr1 = await generateGstr1(db, tenantUserId, period);

    const { start, end } = monthBounds(period);
    const bills = (await db
        .collection('crm_bills')
        .find({
            userId: tenantUserId,
            billDate: { $gte: start, $lt: end },
        })
        .toArray()) as unknown[];

    const outwardTaxable = sumOutwardFromGstr1(gstr1);

    const itc = buildItcFromBills(bills as SourceBillDoc[]);
    const rcm = buildRcmFromBills(bills as SourceBillDoc[]);

    return {
        period,
        outwardSupplies: {
            taxable: outwardTaxable,
            zeroRated: emptyHeads(),
            nilRated: emptyHeads(),
            exempt: emptyHeads(),
            nonGst: emptyHeads(),
        },
        inwardSuppliesRcm: rcm,
        itcClaimed: itc,
        taxLiability: netLiability(outwardTaxable, itc),
        lateFee: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    };
}

/* ─── Pure builders (testable) ───────────────────────────────────────── */

export function sumOutwardFromGstr1(g: {
    b2b: { items: { taxableValue: number; igst: number; cgst: number; sgst: number; cess: number }[]; invoiceValue: number }[];
    b2cl: { items: { taxableValue: number; igst: number; cgst: number; sgst: number; cess: number }[]; invoiceValue: number }[];
    b2cs: { taxableValue: number; igst: number; cgst: number; sgst: number; cess: number }[];
    cdnr: { items: { taxableValue: number; igst: number; cgst: number; sgst: number; cess: number }[]; noteValue: number }[];
}): TaxHeads {
    const totals = emptyHeads();
    const accumulate = (it: { taxableValue: number; igst: number; cgst: number; sgst: number; cess: number }, sign: 1 | -1) => {
        totals.taxableValue += sign * it.taxableValue;
        totals.igst += sign * it.igst;
        totals.cgst += sign * it.cgst;
        totals.sgst += sign * it.sgst;
        totals.cess += sign * it.cess;
    };
    for (const inv of g.b2b) for (const it of inv.items) accumulate(it, 1);
    for (const inv of g.b2cl) for (const it of inv.items) accumulate(it, 1);
    for (const r of g.b2cs) accumulate(r, 1);
    for (const n of g.cdnr) for (const it of n.items) accumulate(it, -1);
    return roundHeads(totals);
}

export function buildItcFromBills(bills: SourceBillDoc[]): Gstr3bItc {
    const claimable = new Set(['approved', 'paid', 'partially_paid']);
    const heads = { igst: 0, cgst: 0, sgst: 0, cess: 0 };
    for (const b of bills) {
        const status = (b.status ?? '').toLowerCase();
        if (!claimable.has(status)) continue;
        const split = splitBillHeads(b);
        heads.igst += split.igst;
        heads.cgst += split.cgst;
        heads.sgst += split.sgst;
        heads.cess += split.cess;
    }
    return {
        igst: round2(heads.igst),
        cgst: round2(heads.cgst),
        sgst: round2(heads.sgst),
        cess: round2(heads.cess),
        reversed: emptyHeads(),
        ineligible: emptyHeads(),
    };
}

/**
 * Reverse-charge inward supplies. Per the spec, RCM applies when:
 *  - `bill.reverseCharge === true`, OR
 *  - the vendor on the bill is unregistered (`vendor.gstin` is empty).
 */
export function buildRcmFromBills(bills: SourceBillDoc[]): TaxHeads {
    const totals = emptyHeads();
    for (const b of bills) {
        const isRcm = b.reverseCharge === true || !b.vendorGstin;
        if (!isRcm) continue;
        const split = splitBillHeads(b);
        totals.taxableValue += split.taxable;
        totals.igst += split.igst;
        totals.cgst += split.cgst;
        totals.sgst += split.sgst;
        totals.cess += split.cess;
    }
    return roundHeads(totals);
}

export function netLiability(outward: TaxHeads, itc: Gstr3bItc): TaxHeads {
    // Net tax = outward heads − ITC. Floor at zero per GSTN.
    const owedIgst = Math.max(0, outward.igst - itc.igst);
    const owedCgst = Math.max(0, outward.cgst - itc.cgst);
    const owedSgst = Math.max(0, outward.sgst - itc.sgst);
    const owedCess = Math.max(0, outward.cess - itc.cess);
    return {
        taxableValue: round2(outward.taxableValue),
        igst: round2(owedIgst),
        cgst: round2(owedCgst),
        sgst: round2(owedSgst),
        cess: round2(owedCess),
    };
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function splitBillHeads(b: SourceBillDoc): {
    taxable: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
} {
    // Prefer pre-computed heads if the bill form populated them.
    if (
        Number.isFinite(b.igst as number) ||
        Number.isFinite(b.cgst as number) ||
        Number.isFinite(b.sgst as number)
    ) {
        return {
            taxable: Number(b.total ?? 0) || 0,
            igst: Number(b.igst ?? 0) || 0,
            cgst: Number(b.cgst ?? 0) || 0,
            sgst: Number(b.sgst ?? 0) || 0,
            cess: Number(b.cess ?? 0) || 0,
        };
    }
    // Otherwise compute from line items. Default to intra-state (CGST+SGST)
    // when we have no place-of-supply signal — documented limitation.
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let cess = 0;
    for (const li of b.items ?? []) {
        const lineTaxable = Number(li.total ?? Number(li.qty ?? 0) * Number(li.rate ?? 0)) || 0;
        const rate = Number(li.taxRate ?? 0) || 0;
        const cessRate = Number(li.cessRate ?? 0) || 0;
        taxable += lineTaxable;
        cgst += (lineTaxable * (rate / 2)) / 100;
        sgst += (lineTaxable * (rate / 2)) / 100;
        cess += (lineTaxable * cessRate) / 100;
    }
    for (const exp of b.expenseLines ?? []) {
        const lineTaxable = Number(exp.amount ?? 0) || 0;
        const rate = Number(exp.taxRate ?? 0) || 0;
        const cessRate = Number(exp.cessRate ?? 0) || 0;
        taxable += lineTaxable;
        cgst += (lineTaxable * (rate / 2)) / 100;
        sgst += (lineTaxable * (rate / 2)) / 100;
        cess += (lineTaxable * cessRate) / 100;
    }
    return { taxable, igst: 0, cgst, sgst, cess };
}

function emptyHeads(): TaxHeads {
    return { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
}

function roundHeads(h: TaxHeads): TaxHeads {
    return {
        taxableValue: round2(h.taxableValue),
        igst: round2(h.igst),
        cgst: round2(h.cgst),
        sgst: round2(h.sgst),
        cess: round2(h.cess),
    };
}

function monthBounds(p: { month: number; year: number }): { start: Date; end: Date } {
    return {
        start: new Date(Date.UTC(p.year, p.month - 1, 1)),
        end: new Date(Date.UTC(p.year, p.month, 1)),
    };
}

/* ─── Engine projection ─────────────────────────────────────────────── */

export function projectGstr3bToReportResult(
    r: Gstr3bReturn,
): { columns: string[]; rows: unknown[][]; summary: Record<string, number> } {
    const rows: unknown[][] = [];
    const pushHead = (section: string, h: TaxHeads) => {
        rows.push([
            section,
            round2(h.taxableValue),
            round2(h.igst),
            round2(h.cgst),
            round2(h.sgst),
            round2(h.cess),
        ]);
    };
    pushHead('3.1(a) Outward taxable', r.outwardSupplies.taxable);
    pushHead('3.1(b) Outward zero-rated', r.outwardSupplies.zeroRated);
    pushHead('3.1(c) Outward nil-rated', r.outwardSupplies.nilRated);
    pushHead('3.1(d) Inward RCM', r.inwardSuppliesRcm);
    pushHead('3.1(e) Non-GST', r.outwardSupplies.nonGst);
    rows.push([
        '4(A) ITC available',
        0,
        round2(r.itcClaimed.igst),
        round2(r.itcClaimed.cgst),
        round2(r.itcClaimed.sgst),
        round2(r.itcClaimed.cess),
    ]);
    pushHead('4(B) ITC reversed', r.itcClaimed.reversed);
    pushHead('4(D) Ineligible', r.itcClaimed.ineligible);
    pushHead('6.1 Tax payable', r.taxLiability);
    return {
        columns: ['section', 'taxable_value', 'igst', 'cgst', 'sgst', 'cess'],
        rows,
        summary: {
            outward_taxable: round2(r.outwardSupplies.taxable.taxableValue),
            outward_total_tax: round2(
                r.outwardSupplies.taxable.igst +
                    r.outwardSupplies.taxable.cgst +
                    r.outwardSupplies.taxable.sgst,
            ),
            itc_total: round2(r.itcClaimed.igst + r.itcClaimed.cgst + r.itcClaimed.sgst),
            net_payable: round2(
                r.taxLiability.igst + r.taxLiability.cgst + r.taxLiability.sgst,
            ),
            rcm_taxable: round2(r.inwardSuppliesRcm.taxableValue),
        },
    };
}

/* ─── Re-exports for callers that only want GSTR-3B types ────────────── */

export type { SourceInvoiceDoc, SourceCreditNoteDoc };
