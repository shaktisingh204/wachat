/**
 * GSTR-1 generator — `CRM_REBUILD_PLAN.md` §6.10.
 *
 * GSTR-1 is the monthly/quarterly outward-supplies return filed by every
 * GST-registered supplier in India. We materialise it from the tenant's
 * `crm_invoices` and `crm_credit_notes` collections and classify each
 * document into one of six sections:
 *
 *   - **B2B**   — buyer has a GSTIN.
 *   - **B2CL**  — buyer is unregistered, supply is inter-state and the
 *                 invoice total exceeds the ₹2,50,000 threshold.
 *   - **B2CS**  — everything else; aggregated per (state × rate).
 *   - **CDNR**  — credit / debit notes against B2B invoices.
 *   - **HSN**   — HSN-code level summary of taxable value + tax heads.
 *   - **DocIssue** — count of documents issued by series.
 *
 * Pure functions: the DB read is `query(db, tenantId, period)`; the
 * classifier and aggregators take plain JS arrays so the unit tests in
 * `__tests__/gstr1.test.ts` can drive them deterministically.
 */

import type { Db, ObjectId } from 'mongodb';

/* ─── DTOs (mirror `rust/crates/crm-extras-types/src/india_tax.rs`) ───── */

export interface B2bInvoice {
    /** Buyer GSTIN. 15 chars. */
    gstin: string;
    /** Invoice number (e.g. `INV-2026-0042`). */
    invoiceNumber: string;
    invoiceDate: string; // dd-mm-yyyy on the GSTN portal
    invoiceValue: number;
    /** Two-digit state code per GSTN, derived from buyer GSTIN[0..2]. */
    placeOfSupply: string;
    reverseCharge: 'Y' | 'N';
    /** `R` regular | `SEWP` SEZ-with-pay | `SEWOP` SEZ-without | `DE`. */
    invoiceType: 'R' | 'SEWP' | 'SEWOP' | 'DE';
    items: GstrLineItem[];
}

export interface B2clInvoice {
    invoiceNumber: string;
    invoiceDate: string;
    invoiceValue: number;
    placeOfSupply: string;
    items: GstrLineItem[];
}

export interface B2csSummary {
    /** Place-of-supply state code. */
    placeOfSupply: string;
    /** `OE` = unregistered (the only kind in B2CS). */
    supplyType: 'INTRA' | 'INTER';
    rate: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
}

export interface CreditDebitNote {
    /** Original B2B invoice number this CDN amends. May be empty. */
    originalInvoiceNumber: string;
    noteNumber: string;
    noteDate: string;
    noteType: 'C' | 'D';
    /** Buyer GSTIN — present for B2B credit notes. */
    gstin: string;
    placeOfSupply: string;
    noteValue: number;
    items: GstrLineItem[];
}

export interface HsnSummary {
    hsnCode: string;
    description?: string;
    /** UQC (unit) code — e.g. NOS, KGS. */
    uqc: string;
    totalQuantity: number;
    totalValue: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
}

export interface DocumentSummary {
    /** `INV` | `CN` | `DN` | etc. */
    docType: string;
    /** Number-series prefix that groups the docs. */
    series: string;
    fromSerial: string;
    toSerial: string;
    totalCount: number;
    cancelled: number;
    netIssued: number;
}

export interface GstrLineItem {
    /** GST rate as a percentage (5, 12, 18, 28, …). */
    rate: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
}

export interface Gstr1Return {
    b2b: B2bInvoice[];
    b2cl: B2clInvoice[];
    b2cs: B2csSummary[];
    cdnr: CreditDebitNote[];
    hsn: HsnSummary[];
    docIssue: DocumentSummary[];
}

/* ─── Inputs the generator reads ─────────────────────────────────────── */

/**
 * Loose shape of the source invoice doc — mirrors what `crm_invoices`
 * actually stores today. Tax fields are sparsely populated; we default
 * everything to zero when missing so the math stays defined.
 */
export interface SourceInvoiceDoc {
    _id?: ObjectId | string;
    userId?: ObjectId | string;
    invoiceNumber: string;
    invoiceDate: Date | string;
    total: number;
    subtotal?: number;
    currency?: string;
    status?: string;
    /** Inlined buyer fields (we join `crm_accounts` ourselves). */
    buyerGstin?: string;
    buyerStateCode?: string;
    /** Origin state of the seller for intra/inter classification. */
    sellerStateCode?: string;
    placeOfSupply?: string;
    reverseCharge?: boolean;
    invoiceType?: B2bInvoice['invoiceType'];
    lineItems?: Array<{
        name?: string;
        description?: string;
        quantity: number;
        rate: number;
        hsnCode?: string;
        taxRate?: number;
        uqc?: string;
        cessRate?: number;
    }>;
    accountId?: ObjectId | string;
}

export interface SourceCreditNoteDoc {
    _id?: ObjectId | string;
    userId?: ObjectId | string;
    creditNoteNumber: string;
    creditNoteDate: Date | string;
    originalInvoiceNumber?: string;
    total: number;
    currency?: string;
    buyerGstin?: string;
    buyerStateCode?: string;
    sellerStateCode?: string;
    placeOfSupply?: string;
    lineItems?: Array<{
        quantity: number;
        rate: number;
        hsnCode?: string;
        taxRate?: number;
        cessRate?: number;
    }>;
    accountId?: ObjectId | string;
}

export interface SourceAccountDoc {
    _id?: ObjectId | string;
    gstin?: string;
    state?: string;
    /** Two-digit GST state code if cached separately. */
    stateCode?: string;
}

/* ─── Constants ──────────────────────────────────────────────────────── */

/** ₹2,50,000 — B2CL inter-state threshold per GSTN rules. */
export const B2CL_THRESHOLD = 250000;

/* ─── Public entry: generateGstr1 ────────────────────────────────────── */

export async function generateGstr1(
    db: Db,
    tenantUserId: ObjectId,
    period: { month: number; year: number },
): Promise<Gstr1Return> {
    const { start, end } = monthBounds(period);

    const [invoices, creditNotes, accounts] = await Promise.all([
        db
            .collection('crm_invoices')
            .find({
                userId: tenantUserId,
                invoiceDate: { $gte: start, $lt: end },
            })
            .toArray() as Promise<unknown[]>,
        db
            .collection('crm_credit_notes')
            .find({
                userId: tenantUserId,
                creditNoteDate: { $gte: start, $lt: end },
            })
            .toArray() as Promise<unknown[]>,
        db
            .collection('crm_accounts')
            .find({ userId: tenantUserId })
            .toArray() as Promise<unknown[]>,
    ]);

    const accountIndex = indexAccountsById(accounts as SourceAccountDoc[]);

    const hydratedInvoices = (invoices as SourceInvoiceDoc[]).map((i) =>
        hydrateInvoice(i, accountIndex),
    );
    const hydratedNotes = (creditNotes as SourceCreditNoteDoc[]).map((n) =>
        hydrateCreditNote(n, accountIndex),
    );

    return buildGstr1Sections(hydratedInvoices, hydratedNotes);
}

/* ─── Pure builders (testable without Mongo) ─────────────────────────── */

export function buildGstr1Sections(
    invoices: SourceInvoiceDoc[],
    creditNotes: SourceCreditNoteDoc[],
): Gstr1Return {
    const b2b: B2bInvoice[] = [];
    const b2cl: B2clInvoice[] = [];
    const b2csMap = new Map<string, B2csSummary>(); // key = `${state}|${rate}`
    const cdnr: CreditDebitNote[] = [];
    const hsnMap = new Map<string, HsnSummary>(); // key = `${hsn}|${uqc}|${rate}`
    const docSeries = new Map<string, { docType: string; series: string; serials: string[] }>();

    for (const inv of invoices) {
        const items = computeLineTaxes(inv);
        const invoiceValue = round2(
            items.reduce(
                (s, it) => s + it.taxableValue + it.igst + it.cgst + it.sgst + it.cess,
                0,
            ),
        );

        // Classification.
        if (inv.buyerGstin && inv.buyerGstin.length >= 15) {
            b2b.push({
                gstin: inv.buyerGstin,
                invoiceNumber: inv.invoiceNumber,
                invoiceDate: formatDdMmYyyy(inv.invoiceDate),
                invoiceValue,
                placeOfSupply: inv.placeOfSupply ?? inv.buyerGstin.slice(0, 2),
                reverseCharge: inv.reverseCharge ? 'Y' : 'N',
                invoiceType: inv.invoiceType ?? 'R',
                items,
            });
        } else {
            const interState = isInterState(inv);
            if (interState && Number(inv.total ?? 0) > B2CL_THRESHOLD) {
                b2cl.push({
                    invoiceNumber: inv.invoiceNumber,
                    invoiceDate: formatDdMmYyyy(inv.invoiceDate),
                    invoiceValue,
                    placeOfSupply: inv.placeOfSupply ?? inv.buyerStateCode ?? '',
                    items,
                });
            } else {
                // B2CS: aggregate per (place-of-supply × rate).
                const pos = inv.placeOfSupply ?? inv.buyerStateCode ?? '';
                for (const it of items) {
                    const key = `${pos}|${it.rate}`;
                    const cur = b2csMap.get(key) ?? {
                        placeOfSupply: pos,
                        supplyType: interState ? 'INTER' : 'INTRA',
                        rate: it.rate,
                        taxableValue: 0,
                        igst: 0,
                        cgst: 0,
                        sgst: 0,
                        cess: 0,
                    };
                    cur.taxableValue += it.taxableValue;
                    cur.igst += it.igst;
                    cur.cgst += it.cgst;
                    cur.sgst += it.sgst;
                    cur.cess += it.cess;
                    b2csMap.set(key, cur);
                }
            }
        }

        // HSN aggregation.
        for (const li of inv.lineItems ?? []) {
            const hsn = li.hsnCode || '0000';
            const uqc = li.uqc || 'NOS';
            const rate = li.taxRate ?? 0;
            const key = `${hsn}|${uqc}|${rate}`;
            const qty = Number(li.quantity ?? 0) || 0;
            const rateMoney = Number(li.rate ?? 0) || 0;
            const taxable = qty * rateMoney;
            const cessRate = li.cessRate ?? 0;
            const heads = splitRate(rate, taxable, isInterState(inv), cessRate);
            const total = taxable + heads.igst + heads.cgst + heads.sgst + heads.cess;
            const cur = hsnMap.get(key) ?? {
                hsnCode: hsn,
                uqc,
                totalQuantity: 0,
                totalValue: 0,
                taxableValue: 0,
                igst: 0,
                cgst: 0,
                sgst: 0,
                cess: 0,
            };
            cur.totalQuantity += qty;
            cur.totalValue += total;
            cur.taxableValue += taxable;
            cur.igst += heads.igst;
            cur.cgst += heads.cgst;
            cur.sgst += heads.sgst;
            cur.cess += heads.cess;
            hsnMap.set(key, cur);
        }

        // Document-series counter.
        const { series } = splitSeriesAndSerial(inv.invoiceNumber);
        const docKey = `INV|${series}`;
        const bucket =
            docSeries.get(docKey) ?? { docType: 'INV', series, serials: [] as string[] };
        bucket.serials.push(inv.invoiceNumber);
        docSeries.set(docKey, bucket);
    }

    for (const note of creditNotes) {
        const interState = isInterState(note);
        const items = computeLineTaxes(note);
        const noteValue = round2(
            items.reduce(
                (s, it) => s + it.taxableValue + it.igst + it.cgst + it.sgst + it.cess,
                0,
            ),
        );
        cdnr.push({
            originalInvoiceNumber: note.originalInvoiceNumber ?? '',
            noteNumber: note.creditNoteNumber,
            noteDate: formatDdMmYyyy(note.creditNoteDate),
            noteType: 'C',
            gstin: note.buyerGstin ?? '',
            placeOfSupply:
                note.placeOfSupply ?? note.buyerStateCode ?? (note.buyerGstin?.slice(0, 2) ?? ''),
            noteValue,
            items,
        });
        // HSN aggregation for credit-notes is negative — but the
        // portal expects credit notes in their own section, so we
        // don't fold them into HSN totals here. (Mirrors GSTN behaviour
        // pre-Aug-2022; we'll wire the post-2022 net-of-CDN HSN flag
        // when the matcher in §6.10c lands.)
        void interState;
    }

    const b2cs: B2csSummary[] = [...b2csMap.values()].map((r) => ({
        ...r,
        taxableValue: round2(r.taxableValue),
        igst: round2(r.igst),
        cgst: round2(r.cgst),
        sgst: round2(r.sgst),
        cess: round2(r.cess),
    }));

    const hsn: HsnSummary[] = [...hsnMap.values()].map((r) => ({
        ...r,
        totalQuantity: round2(r.totalQuantity),
        totalValue: round2(r.totalValue),
        taxableValue: round2(r.taxableValue),
        igst: round2(r.igst),
        cgst: round2(r.cgst),
        sgst: round2(r.sgst),
        cess: round2(r.cess),
    }));

    const docIssue: DocumentSummary[] = [...docSeries.values()].map((b) => {
        const sorted = [...b.serials].sort();
        return {
            docType: b.docType,
            series: b.series,
            fromSerial: sorted[0] ?? '',
            toSerial: sorted[sorted.length - 1] ?? '',
            totalCount: sorted.length,
            cancelled: 0,
            netIssued: sorted.length,
        };
    });
    // Credit notes too.
    const cnSeries = new Map<string, string[]>();
    for (const n of creditNotes) {
        const { series } = splitSeriesAndSerial(n.creditNoteNumber);
        const key = series;
        const arr = cnSeries.get(key) ?? [];
        arr.push(n.creditNoteNumber);
        cnSeries.set(key, arr);
    }
    for (const [series, serials] of cnSeries.entries()) {
        const sorted = [...serials].sort();
        docIssue.push({
            docType: 'CN',
            series,
            fromSerial: sorted[0] ?? '',
            toSerial: sorted[sorted.length - 1] ?? '',
            totalCount: sorted.length,
            cancelled: 0,
            netIssued: sorted.length,
        });
    }

    return { b2b, b2cl, b2cs, cdnr, hsn, docIssue };
}

/* ─── Tax computation helpers ────────────────────────────────────────── */

function computeLineTaxes(
    doc: SourceInvoiceDoc | SourceCreditNoteDoc,
): GstrLineItem[] {
    const inter = isInterState(doc);
    const out: GstrLineItem[] = [];
    const byRate = new Map<number, GstrLineItem>();
    for (const li of doc.lineItems ?? []) {
        const qty = Number(li.quantity ?? 0) || 0;
        const rateMoney = Number(li.rate ?? 0) || 0;
        const taxable = qty * rateMoney;
        const taxRate = Number(li.taxRate ?? 0) || 0;
        const cessRate = Number(('cessRate' in li ? li.cessRate : 0) ?? 0) || 0;
        const heads = splitRate(taxRate, taxable, inter, cessRate);
        const cur = byRate.get(taxRate) ?? {
            rate: taxRate,
            taxableValue: 0,
            igst: 0,
            cgst: 0,
            sgst: 0,
            cess: 0,
        };
        cur.taxableValue += taxable;
        cur.igst += heads.igst;
        cur.cgst += heads.cgst;
        cur.sgst += heads.sgst;
        cur.cess += heads.cess;
        byRate.set(taxRate, cur);
    }
    for (const v of byRate.values()) {
        out.push({
            rate: v.rate,
            taxableValue: round2(v.taxableValue),
            igst: round2(v.igst),
            cgst: round2(v.cgst),
            sgst: round2(v.sgst),
            cess: round2(v.cess),
        });
    }
    return out;
}

function splitRate(
    rate: number,
    taxable: number,
    interState: boolean,
    cessRate: number,
): { igst: number; cgst: number; sgst: number; cess: number } {
    const cess = (taxable * cessRate) / 100;
    if (interState) {
        return { igst: (taxable * rate) / 100, cgst: 0, sgst: 0, cess };
    }
    const half = rate / 2;
    return {
        igst: 0,
        cgst: (taxable * half) / 100,
        sgst: (taxable * half) / 100,
        cess,
    };
}

function isInterState(doc: SourceInvoiceDoc | SourceCreditNoteDoc): boolean {
    const buyer = doc.placeOfSupply ?? doc.buyerStateCode ?? doc.buyerGstin?.slice(0, 2) ?? '';
    const seller = doc.sellerStateCode ?? '';
    if (!buyer || !seller) {
        // Default: treat as intra-state when we can't tell. Documented
        // limitation — flagged for the matcher to revisit.
        return false;
    }
    return buyer !== seller;
}

/* ─── Account hydration ──────────────────────────────────────────────── */

function indexAccountsById(
    accounts: SourceAccountDoc[],
): Map<string, SourceAccountDoc> {
    const m = new Map<string, SourceAccountDoc>();
    for (const a of accounts) {
        if (!a._id) continue;
        m.set(String(a._id), a);
    }
    return m;
}

function hydrateInvoice(
    inv: SourceInvoiceDoc,
    accounts: Map<string, SourceAccountDoc>,
): SourceInvoiceDoc {
    if (inv.buyerGstin && inv.placeOfSupply) return inv;
    const acc = inv.accountId ? accounts.get(String(inv.accountId)) : undefined;
    if (!acc) return inv;
    return {
        ...inv,
        buyerGstin: inv.buyerGstin ?? acc.gstin,
        buyerStateCode:
            inv.buyerStateCode ?? acc.stateCode ?? acc.gstin?.slice(0, 2),
        placeOfSupply:
            inv.placeOfSupply ?? acc.stateCode ?? acc.gstin?.slice(0, 2),
    };
}

function hydrateCreditNote(
    note: SourceCreditNoteDoc,
    accounts: Map<string, SourceAccountDoc>,
): SourceCreditNoteDoc {
    if (note.buyerGstin && note.placeOfSupply) return note;
    const acc = note.accountId ? accounts.get(String(note.accountId)) : undefined;
    if (!acc) return note;
    return {
        ...note,
        buyerGstin: note.buyerGstin ?? acc.gstin,
        buyerStateCode:
            note.buyerStateCode ?? acc.stateCode ?? acc.gstin?.slice(0, 2),
        placeOfSupply:
            note.placeOfSupply ?? acc.stateCode ?? acc.gstin?.slice(0, 2),
    };
}

/* ─── Misc helpers ───────────────────────────────────────────────────── */

function monthBounds(p: { month: number; year: number }): {
    start: Date;
    end: Date;
} {
    // `month` is 1-based here so callers can write `{ month: 4, year: 2026 }`.
    const start = new Date(Date.UTC(p.year, p.month - 1, 1));
    const end = new Date(Date.UTC(p.year, p.month, 1));
    return { start, end };
}

function formatDdMmYyyy(d: Date | string): string {
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = String(dt.getUTCFullYear());
    return `${dd}-${mm}-${yyyy}`;
}

function splitSeriesAndSerial(no: string): { series: string; serial: string } {
    // Treat the trailing run of digits as the serial; everything before
    // (including a trailing `-`) is the series. `INV-2026-0042` → series
    // `INV-2026-`, serial `0042`.
    const m = /^(.*?)(\d+)$/.exec(no);
    if (!m) return { series: no, serial: '' };
    return { series: m[1], serial: m[2] };
}

/** Half-up rounding to 2 decimal places (matches GSTN portal behaviour). */
export function round2(n: number): number {
    if (!Number.isFinite(n)) return 0;
    // `Math.round` is banker's-half-to-even in some engines for
    // edge cases; force half-up explicitly.
    return Math.sign(n) * Math.round(Math.abs(n) * 100 + Number.EPSILON) / 100;
}

/* ─── GSTN-portal JSON projector ─────────────────────────────────────── */

/**
 * Project a `Gstr1Return` into the upload-shape the GST portal expects.
 * Schema follows the GSTN GSTR-1 JSON spec v3.0 — only the sections we
 * actually emit are populated; everything else is omitted.
 */
export function projectGstr1ToGstnJson(
    gstr1: Gstr1Return,
    meta: { gstin: string; period: { month: number; year: number } },
): Record<string, unknown> {
    const fp = `${String(meta.period.month).padStart(2, '0')}${meta.period.year}`;
    return {
        gstin: meta.gstin,
        fp,
        version: 'GST3.0.4',
        hash: 'hash',
        b2b: groupByGstin(gstr1.b2b),
        b2cl: groupByState(gstr1.b2cl),
        b2cs: gstr1.b2cs.map((r) => ({
            sply_ty: r.supplyType,
            pos: r.placeOfSupply,
            rt: r.rate,
            txval: r.taxableValue,
            iamt: r.igst,
            camt: r.cgst,
            samt: r.sgst,
            csamt: r.cess,
        })),
        cdnr: groupCdnr(gstr1.cdnr),
        hsn: {
            data: gstr1.hsn.map((h, i) => ({
                num: i + 1,
                hsn_sc: h.hsnCode,
                desc: h.description ?? '',
                uqc: h.uqc,
                qty: h.totalQuantity,
                val: h.totalValue,
                txval: h.taxableValue,
                iamt: h.igst,
                camt: h.cgst,
                samt: h.sgst,
                csamt: h.cess,
            })),
        },
        doc_issue: {
            doc_det: gstr1.docIssue.map((d, i) => ({
                doc_num: i + 1,
                doc_typ: d.docType,
                docs: [
                    {
                        num: i + 1,
                        from: d.fromSerial,
                        to: d.toSerial,
                        totnum: d.totalCount,
                        cancel: d.cancelled,
                        net_issue: d.netIssued,
                    },
                ],
            })),
        },
    };
}

function groupByGstin(b2b: B2bInvoice[]): Array<Record<string, unknown>> {
    const m = new Map<string, B2bInvoice[]>();
    for (const r of b2b) {
        const arr = m.get(r.gstin) ?? [];
        arr.push(r);
        m.set(r.gstin, arr);
    }
    return [...m.entries()].map(([gstin, rows]) => ({
        ctin: gstin,
        inv: rows.map((r) => ({
            inum: r.invoiceNumber,
            idt: r.invoiceDate,
            val: r.invoiceValue,
            pos: r.placeOfSupply,
            rchrg: r.reverseCharge,
            inv_typ: r.invoiceType,
            itms: r.items.map((it, i) => ({
                num: i + 1,
                itm_det: {
                    rt: it.rate,
                    txval: it.taxableValue,
                    iamt: it.igst,
                    camt: it.cgst,
                    samt: it.sgst,
                    csamt: it.cess,
                },
            })),
        })),
    }));
}

function groupByState(b2cl: B2clInvoice[]): Array<Record<string, unknown>> {
    const m = new Map<string, B2clInvoice[]>();
    for (const r of b2cl) {
        const arr = m.get(r.placeOfSupply) ?? [];
        arr.push(r);
        m.set(r.placeOfSupply, arr);
    }
    return [...m.entries()].map(([pos, rows]) => ({
        pos,
        inv: rows.map((r) => ({
            inum: r.invoiceNumber,
            idt: r.invoiceDate,
            val: r.invoiceValue,
            itms: r.items.map((it, i) => ({
                num: i + 1,
                itm_det: {
                    rt: it.rate,
                    txval: it.taxableValue,
                    iamt: it.igst,
                    csamt: it.cess,
                },
            })),
        })),
    }));
}

function groupCdnr(cdnr: CreditDebitNote[]): Array<Record<string, unknown>> {
    const m = new Map<string, CreditDebitNote[]>();
    for (const r of cdnr) {
        const key = r.gstin || '__b2c__';
        const arr = m.get(key) ?? [];
        arr.push(r);
        m.set(key, arr);
    }
    return [...m.entries()].map(([gstin, rows]) => ({
        ctin: gstin === '__b2c__' ? undefined : gstin,
        nt: rows.map((r) => ({
            ntty: r.noteType,
            nt_num: r.noteNumber,
            nt_dt: r.noteDate,
            p_gst: r.originalInvoiceNumber,
            val: r.noteValue,
            pos: r.placeOfSupply,
            itms: r.items.map((it, i) => ({
                num: i + 1,
                itm_det: {
                    rt: it.rate,
                    txval: it.taxableValue,
                    iamt: it.igst,
                    camt: it.cgst,
                    samt: it.sgst,
                    csamt: it.cess,
                },
            })),
        })),
    }));
}

/* ─── Engine projection (columns/rows/summary) ───────────────────────── */

/**
 * Flatten a `Gstr1Return` into the engine's `{ columns, rows, summary }`
 * contract so `runReport({ kind: 'gstr1' })` can return tabular output.
 */
export function projectGstr1ToReportResult(
    g: Gstr1Return,
): { columns: string[]; rows: unknown[][]; summary: Record<string, number> } {
    const rows: unknown[][] = [];
    const totals = {
        taxable: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        cess: 0,
        invoiceValue: 0,
    };
    for (const r of g.b2b) {
        const taxable = sum(r.items.map((i) => i.taxableValue));
        const igst = sum(r.items.map((i) => i.igst));
        const cgst = sum(r.items.map((i) => i.cgst));
        const sgst = sum(r.items.map((i) => i.sgst));
        const cess = sum(r.items.map((i) => i.cess));
        rows.push([
            'B2B',
            r.invoiceNumber,
            r.invoiceDate,
            r.gstin,
            r.placeOfSupply,
            round2(taxable),
            round2(igst),
            round2(cgst),
            round2(sgst),
            round2(cess),
            round2(r.invoiceValue),
        ]);
        totals.taxable += taxable;
        totals.igst += igst;
        totals.cgst += cgst;
        totals.sgst += sgst;
        totals.cess += cess;
        totals.invoiceValue += r.invoiceValue;
    }
    for (const r of g.b2cl) {
        const taxable = sum(r.items.map((i) => i.taxableValue));
        const igst = sum(r.items.map((i) => i.igst));
        rows.push([
            'B2CL',
            r.invoiceNumber,
            r.invoiceDate,
            '',
            r.placeOfSupply,
            round2(taxable),
            round2(igst),
            0,
            0,
            0,
            round2(r.invoiceValue),
        ]);
        totals.taxable += taxable;
        totals.igst += igst;
        totals.invoiceValue += r.invoiceValue;
    }
    for (const r of g.b2cs) {
        rows.push([
            'B2CS',
            '',
            '',
            '',
            r.placeOfSupply,
            r.taxableValue,
            r.igst,
            r.cgst,
            r.sgst,
            r.cess,
            round2(r.taxableValue + r.igst + r.cgst + r.sgst + r.cess),
        ]);
        totals.taxable += r.taxableValue;
        totals.igst += r.igst;
        totals.cgst += r.cgst;
        totals.sgst += r.sgst;
        totals.cess += r.cess;
        totals.invoiceValue += r.taxableValue + r.igst + r.cgst + r.sgst + r.cess;
    }
    for (const r of g.cdnr) {
        const taxable = sum(r.items.map((i) => i.taxableValue));
        const igst = sum(r.items.map((i) => i.igst));
        const cgst = sum(r.items.map((i) => i.cgst));
        const sgst = sum(r.items.map((i) => i.sgst));
        rows.push([
            'CDNR',
            r.noteNumber,
            r.noteDate,
            r.gstin,
            r.placeOfSupply,
            round2(-taxable),
            round2(-igst),
            round2(-cgst),
            round2(-sgst),
            0,
            round2(-r.noteValue),
        ]);
        totals.taxable -= taxable;
        totals.igst -= igst;
        totals.cgst -= cgst;
        totals.sgst -= sgst;
        totals.invoiceValue -= r.noteValue;
    }
    return {
        columns: [
            'section',
            'doc_no',
            'doc_date',
            'gstin',
            'pos',
            'taxable',
            'igst',
            'cgst',
            'sgst',
            'cess',
            'invoice_value',
        ],
        rows,
        summary: {
            b2b_count: g.b2b.length,
            b2cl_count: g.b2cl.length,
            b2cs_count: g.b2cs.length,
            cdnr_count: g.cdnr.length,
            hsn_rows: g.hsn.length,
            taxable: round2(totals.taxable),
            igst: round2(totals.igst),
            cgst: round2(totals.cgst),
            sgst: round2(totals.sgst),
            cess: round2(totals.cess),
            total_tax: round2(totals.igst + totals.cgst + totals.sgst + totals.cess),
            invoice_value: round2(totals.invoiceValue),
        },
    };
}

function sum(arr: number[]): number {
    let t = 0;
    for (const x of arr) t += x;
    return t;
}
