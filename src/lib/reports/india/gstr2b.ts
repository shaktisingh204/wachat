/**
 * GSTR-2B parser + viewer — `CRM_REBUILD_PLAN.md` §6.10.
 *
 * GSTR-2B is **auto-drafted** by the GSTN portal — we don't generate
 * it. The user downloads the official JSON from the portal and uploads
 * it here; this module validates the shape, normalises it into our own
 * `Gstr2bReturn` DTO, and produces a summary suitable for the viewer
 * page.
 *
 * Matching against `crm_bills` (ITC reconciliation) is **out of scope**
 * for this sub-task — the matcher lives in §6.10c. We persist the
 * import unchanged so the matcher can read it later.
 */

/* ─── Normalised DTO (matches the camelCase shape we use elsewhere) ──── */

export interface Gstr2bSupplier {
    gstin: string;
    tradeName?: string;
    /** Sum of all invoice taxable value contributed by this supplier. */
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    invoiceCount: number;
}

export interface Gstr2bInvoice {
    supplierGstin: string;
    supplierName?: string;
    invoiceNumber: string;
    invoiceDate: string;
    invoiceType: string;
    placeOfSupply: string;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    itcAvailable: 'Y' | 'N';
}

export interface Gstr2bReturn {
    /** Period as `MM-YYYY` (matches GSTN). */
    period: string;
    gstin: string;
    /** Total ITC available (4A). */
    totalItcAvailable: { igst: number; cgst: number; sgst: number; cess: number };
    /** Total ITC ineligible (4B). */
    totalItcIneligible: { igst: number; cgst: number; sgst: number; cess: number };
    invoices: Gstr2bInvoice[];
    suppliers: Gstr2bSupplier[];
}

/* ─── Parser ─────────────────────────────────────────────────────────── */

export class Gstr2bParseError extends Error {
    constructor(public readonly reason: string, public readonly path?: string) {
        super(path ? `${reason} (at ${path})` : reason);
        this.name = 'Gstr2bParseError';
    }
}

/**
 * Parse the GSTR-2B JSON exported from the GSTN portal. Rejects:
 *   - malformed JSON
 *   - missing `gstin` or `rtnprd`
 *   - missing top-level `data` (or `data.docdata`) keys
 *
 * Returns a fully-normalised `Gstr2bReturn`. Numeric heads are coerced
 * to `Number` and defaulted to 0 when absent.
 */
export function parseGstr2bJson(jsonString: string): Gstr2bReturn {
    if (typeof jsonString !== 'string' || jsonString.trim().length === 0) {
        throw new Gstr2bParseError('empty_payload');
    }
    let parsed: any;
    try {
        parsed = JSON.parse(jsonString);
    } catch (e) {
        throw new Gstr2bParseError(
            `invalid_json: ${e instanceof Error ? e.message : String(e)}`,
        );
    }
    if (!parsed || typeof parsed !== 'object') {
        throw new Gstr2bParseError('payload_not_object');
    }

    // GSTN wraps the actual data under `.data` (portal export shape).
    // We accept either the wrapped or unwrapped form so future portal
    // schema changes don't immediately break us.
    const data = parsed.data ?? parsed;

    const gstin = String(data.gstin ?? '');
    const period = String(data.rtnprd ?? data.period ?? '');
    if (!gstin) throw new Gstr2bParseError('missing_gstin', 'data.gstin');
    if (!period) throw new Gstr2bParseError('missing_period', 'data.rtnprd');

    // Invoices live at `data.docdata.b2b` per the GSTN spec.
    const docdata = data.docdata ?? data.itcAvl ?? {};
    const b2bRaw: any[] = Array.isArray(docdata.b2b) ? docdata.b2b : [];

    const invoices: Gstr2bInvoice[] = [];
    for (const sup of b2bRaw) {
        const supplierGstin = String(sup.ctin ?? sup.gstin ?? '');
        const supplierName = sup.trdnm ? String(sup.trdnm) : undefined;
        const invs: any[] = Array.isArray(sup.inv) ? sup.inv : [];
        for (const inv of invs) {
            invoices.push({
                supplierGstin,
                supplierName,
                invoiceNumber: String(inv.inum ?? ''),
                invoiceDate: String(inv.idt ?? ''),
                invoiceType: String(inv.typ ?? inv.inv_typ ?? 'R'),
                placeOfSupply: String(inv.pos ?? ''),
                taxableValue: num(inv.txval ?? inv.itc?.txval),
                igst: num(inv.iamt ?? inv.itc?.igst),
                cgst: num(inv.camt ?? inv.itc?.cgst),
                sgst: num(inv.samt ?? inv.itc?.sgst),
                cess: num(inv.csamt ?? inv.itc?.cess),
                itcAvailable: (inv.itc_avl ?? 'Y') === 'N' ? 'N' : 'Y',
            });
        }
    }

    const totalsAvailable = parsed.itc?.itcAvl ?? data.itcsumm?.itcavl ?? {};
    const totalsIneligible = parsed.itc?.itcUnavl ?? data.itcsumm?.itcunavl ?? {};

    return {
        period,
        gstin,
        totalItcAvailable: {
            igst: num(totalsAvailable.iamt),
            cgst: num(totalsAvailable.camt),
            sgst: num(totalsAvailable.samt),
            cess: num(totalsAvailable.csamt),
        },
        totalItcIneligible: {
            igst: num(totalsIneligible.iamt),
            cgst: num(totalsIneligible.camt),
            sgst: num(totalsIneligible.samt),
            cess: num(totalsIneligible.csamt),
        },
        invoices,
        suppliers: aggregateSuppliers(invoices),
    };
}

/* ─── Summarisers ────────────────────────────────────────────────────── */

export function summarizeGstr2b(g: Gstr2bReturn): {
    totalItcAvailable: number;
    totalIneligible: number;
    bySupplier: Gstr2bSupplier[];
    invoiceCount: number;
} {
    const sumAvail =
        g.totalItcAvailable.igst +
        g.totalItcAvailable.cgst +
        g.totalItcAvailable.sgst +
        g.totalItcAvailable.cess;
    const sumIneligible =
        g.totalItcIneligible.igst +
        g.totalItcIneligible.cgst +
        g.totalItcIneligible.sgst +
        g.totalItcIneligible.cess;
    return {
        totalItcAvailable: round2(sumAvail),
        totalIneligible: round2(sumIneligible),
        bySupplier: g.suppliers,
        invoiceCount: g.invoices.length,
    };
}

function aggregateSuppliers(invoices: Gstr2bInvoice[]): Gstr2bSupplier[] {
    const m = new Map<string, Gstr2bSupplier>();
    for (const inv of invoices) {
        const cur =
            m.get(inv.supplierGstin) ??
            ({
                gstin: inv.supplierGstin,
                tradeName: inv.supplierName,
                taxableValue: 0,
                igst: 0,
                cgst: 0,
                sgst: 0,
                cess: 0,
                invoiceCount: 0,
            } satisfies Gstr2bSupplier);
        cur.taxableValue += inv.taxableValue;
        cur.igst += inv.igst;
        cur.cgst += inv.cgst;
        cur.sgst += inv.sgst;
        cur.cess += inv.cess;
        cur.invoiceCount += 1;
        m.set(inv.supplierGstin, cur);
    }
    return [...m.values()].map((s) => ({
        ...s,
        taxableValue: round2(s.taxableValue),
        igst: round2(s.igst),
        cgst: round2(s.cgst),
        sgst: round2(s.sgst),
        cess: round2(s.cess),
    }));
}

/* ─── Engine projection ─────────────────────────────────────────────── */

export function projectGstr2bToReportResult(
    g: Gstr2bReturn,
): { columns: string[]; rows: unknown[][]; summary: Record<string, number> } {
    const rows: unknown[][] = g.suppliers.map((s) => [
        s.gstin,
        s.tradeName ?? '',
        s.invoiceCount,
        s.taxableValue,
        s.igst,
        s.cgst,
        s.sgst,
        s.cess,
    ]);
    const summary = summarizeGstr2b(g);
    return {
        columns: ['gstin', 'trade_name', 'invoices', 'taxable', 'igst', 'cgst', 'sgst', 'cess'],
        rows,
        summary: {
            suppliers: g.suppliers.length,
            invoices: summary.invoiceCount,
            itc_available: summary.totalItcAvailable,
            ineligible: summary.totalIneligible,
        },
    };
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function num(v: unknown): number {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.sign(n) * Math.round(Math.abs(n) * 100 + Number.EPSILON) / 100;
}
