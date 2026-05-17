/**
 * §6.10 ITC ledger + GSTR-2B reconciliation (pure logic).
 *
 * Computes the buyer's claimable Input Tax Credit (ITC) from
 * `crm_bills` (book ITC) and reconciles it against an imported GSTR-2B
 * snapshot (`crm_gstr2b_imports`, owned by §6.10a).
 *
 * **Book ITC scope**: Only bills with status ∈ {`approved`, `paid`,
 * `partially_paid`} (or their PascalCase legacy variants) and
 * `reverseCharge !== true` count. RCM bills are excluded because the
 * buyer pays the tax on behalf of the supplier — that ITC is tracked
 * separately on the RCM register.
 *
 * **Reconciliation strategy**:
 *  1. Exact match by `(supplierGstin, invoiceNumber)` — case-insensitive.
 *  2. Fuzzy fallback by `(supplierGstin, totalAmount ± 5 INR)` for the
 *     remainder. Anything still unmatched lands in `onlyInBooks` or
 *     `onlyInGstr2b`.
 *
 * No Mongo writes from this module — callers persist results.
 *
 * The Mongo calls live behind a thin `connectToDatabase()` indirection
 * which is dynamically imported so the file stays unit-testable without
 * pulling in `server-only`.
 */

import { ObjectId } from 'mongodb';

/* ─── Types ─────────────────────────────────────────────────────── */

export interface BookItcRow {
    /** Supplier GSTIN as recorded on the bill / vendor master. */
    gstin: string | null;
    supplierName: string;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    invoiceCount: number;
}

export interface BookItcResult {
    bySupplier: BookItcRow[];
    period: string;
}

/** Shape of a single line item from `crm_bills.items`. */
interface BillItem {
    igstAmount?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    cessAmount?: number;
}

/** Shape of a bill row used for ITC aggregation. */
export interface BillForItc {
    _id: ObjectId | string;
    vendorId?: ObjectId | string;
    vendorInvoiceNo?: string;
    billNo?: string;
    billDate: Date | string;
    status?: string;
    reverseCharge?: boolean;
    items?: BillItem[];
    total?: number;
    totals?: { total?: number };
    /** Joined fields (look-up at query time). */
    vendorName?: string;
    vendorGstin?: string | null;
}

export interface Gstr2bInvoice {
    supplierGstin: string;
    supplierName?: string;
    invoiceNumber: string;
    invoiceDate?: Date | string;
    totalAmount: number;
    igst?: number;
    cgst?: number;
    sgst?: number;
    cess?: number;
}

export interface ItcReconciliationMatched {
    supplierGstin: string;
    supplierName: string;
    invoiceNumber: string;
    bookAmount: number;
    gstr2bAmount: number;
    bookItc: number;
    gstr2bItc: number;
    /** Match strategy used — `'exact'` for invoice-number, `'fuzzy'` for amount. */
    matchType: 'exact' | 'fuzzy';
}

export interface ItcReconciliationRow {
    supplierGstin: string | null;
    supplierName: string;
    invoiceNumber: string;
    amount: number;
    itc: number;
}

export interface ItcReconciliationResult {
    period: string;
    matched: ItcReconciliationMatched[];
    onlyInBooks: ItcReconciliationRow[];
    onlyInGstr2b: ItcReconciliationRow[];
    mismatchedAmount: number;
    summary: {
        totalBookItc: number;
        totalGstr2bItc: number;
        totalMatched: number;
        totalOnlyInBooks: number;
        totalOnlyInGstr2b: number;
    };
}

export type ItcReconciliationError = { error: 'gstr2b_import_required' };

/* ─── Helpers ───────────────────────────────────────────────────── */

const APPROVED_STATUSES = new Set<string>([
    'approved',
    'paid',
    'partially_paid',
    'partiallyPaid',
    'Approved',
    'Paid',
    'PartiallyPaid',
]);

function isClaimableStatus(status?: string): boolean {
    if (!status) return false;
    return APPROVED_STATUSES.has(status);
}

function billTotal(b: BillForItc): number {
    if (typeof b.totals?.total === 'number') return b.totals.total;
    if (typeof b.total === 'number') return b.total;
    return 0;
}

function sumItcFromBill(b: BillForItc): {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
} {
    let igst = 0;
    let cgst = 0;
    let sgst = 0;
    let cess = 0;
    for (const it of b.items ?? []) {
        igst += it.igstAmount ?? 0;
        cgst += it.cgstAmount ?? 0;
        sgst += it.sgstAmount ?? 0;
        cess += it.cessAmount ?? 0;
    }
    return { igst, cgst, sgst, cess };
}

function periodToRange(period: string): { start: Date; end: Date } {
    // Accepts `YYYY-MM` (preferred). Reject otherwise — caller's
    // problem.
    const m = period.match(/^(\d{4})-(\d{2})$/);
    if (!m) {
        const now = new Date();
        return {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
        };
    }
    const year = Number(m[1]);
    const month = Number(m[2]); // 1-12
    return {
        start: new Date(year, month - 1, 1),
        end: new Date(year, month, 0, 23, 59, 59, 999),
    };
}

/* ─── Pure aggregator (testable) ────────────────────────────────── */

/**
 * Aggregate book ITC from a list of bill rows. Pure; takes already-
 * loaded bills + joined vendor info so it can be unit-tested without a
 * database.
 */
export function aggregateBookItc(
    bills: BillForItc[],
    period: string,
): BookItcResult {
    const range = periodToRange(period);
    const startTs = range.start.getTime();
    const endTs = range.end.getTime();

    const bySupplier = new Map<string, BookItcRow>();

    for (const b of bills) {
        if (!isClaimableStatus(b.status)) continue;
        if (b.reverseCharge === true) continue;

        const billDate = new Date(b.billDate);
        const ts = billDate.getTime();
        if (Number.isNaN(ts) || ts < startTs || ts > endTs) continue;

        const { igst, cgst, sgst, cess } = sumItcFromBill(b);
        // Skip bills with zero ITC entirely — they don't contribute.
        if (igst + cgst + sgst + cess === 0) continue;

        const gstin = (b.vendorGstin ?? null) as string | null;
        const key = gstin ?? `__no_gstin__::${b.vendorId ?? b.vendorName ?? ''}`;
        const row = bySupplier.get(key) ?? {
            gstin,
            supplierName: b.vendorName ?? 'Unknown vendor',
            igst: 0,
            cgst: 0,
            sgst: 0,
            cess: 0,
            invoiceCount: 0,
        };
        row.igst += igst;
        row.cgst += cgst;
        row.sgst += sgst;
        row.cess += cess;
        row.invoiceCount += 1;
        bySupplier.set(key, row);
    }

    return {
        bySupplier: Array.from(bySupplier.values()).sort(
            (a, b) =>
                b.igst + b.cgst + b.sgst + b.cess - (a.igst + a.cgst + a.sgst + a.cess),
        ),
        period,
    };
}

/**
 * Pure reconciliation — accepts already-resolved book + GSTR-2B rows,
 * returns the matched / only-in-books / only-in-2b breakdown.
 *
 * Each book row represents a single bill (invoice-level granularity).
 */
export function reconcileItc(
    bookRows: Array<{
        supplierGstin: string | null;
        supplierName: string;
        invoiceNumber: string;
        amount: number;
        itc: number;
    }>,
    gstr2bRows: Gstr2bInvoice[],
    period: string,
): ItcReconciliationResult {
    const TOLERANCE = 5; // ±5 INR

    const matched: ItcReconciliationMatched[] = [];
    const usedBookIdx = new Set<number>();
    const usedGstr2bIdx = new Set<number>();

    // Pass 1 — exact invoice number match (case-insensitive, trimmed).
    const gstr2bByKey = new Map<string, number[]>();
    gstr2bRows.forEach((g, i) => {
        const key = `${(g.supplierGstin ?? '').toUpperCase()}::${(g.invoiceNumber ?? '').trim().toUpperCase()}`;
        const arr = gstr2bByKey.get(key) ?? [];
        arr.push(i);
        gstr2bByKey.set(key, arr);
    });

    bookRows.forEach((b, i) => {
        if (!b.supplierGstin || !b.invoiceNumber) return;
        const key = `${b.supplierGstin.toUpperCase()}::${b.invoiceNumber.trim().toUpperCase()}`;
        const bucket = gstr2bByKey.get(key);
        if (!bucket?.length) return;
        // Pick the first unused.
        const idx = bucket.find((j) => !usedGstr2bIdx.has(j));
        if (idx === undefined) return;
        const g = gstr2bRows[idx];
        const gItc = (g.igst ?? 0) + (g.cgst ?? 0) + (g.sgst ?? 0) + (g.cess ?? 0);
        matched.push({
            supplierGstin: b.supplierGstin,
            supplierName: b.supplierName,
            invoiceNumber: b.invoiceNumber,
            bookAmount: b.amount,
            gstr2bAmount: g.totalAmount,
            bookItc: b.itc,
            gstr2bItc: gItc,
            matchType: 'exact',
        });
        usedBookIdx.add(i);
        usedGstr2bIdx.add(idx);
    });

    // Pass 2 — fuzzy fallback by (gstin, amount ±5).
    bookRows.forEach((b, i) => {
        if (usedBookIdx.has(i)) return;
        if (!b.supplierGstin) return;
        const gstinUpper = b.supplierGstin.toUpperCase();
        let bestIdx = -1;
        let bestDiff = TOLERANCE + 1;
        for (let j = 0; j < gstr2bRows.length; j += 1) {
            if (usedGstr2bIdx.has(j)) continue;
            const g = gstr2bRows[j];
            if ((g.supplierGstin ?? '').toUpperCase() !== gstinUpper) continue;
            const diff = Math.abs(b.amount - g.totalAmount);
            if (diff <= TOLERANCE && diff < bestDiff) {
                bestDiff = diff;
                bestIdx = j;
            }
        }
        if (bestIdx === -1) return;
        const g = gstr2bRows[bestIdx];
        const gItc = (g.igst ?? 0) + (g.cgst ?? 0) + (g.sgst ?? 0) + (g.cess ?? 0);
        matched.push({
            supplierGstin: b.supplierGstin,
            supplierName: b.supplierName,
            invoiceNumber: b.invoiceNumber,
            bookAmount: b.amount,
            gstr2bAmount: g.totalAmount,
            bookItc: b.itc,
            gstr2bItc: gItc,
            matchType: 'fuzzy',
        });
        usedBookIdx.add(i);
        usedGstr2bIdx.add(bestIdx);
    });

    const onlyInBooks: ItcReconciliationRow[] = bookRows
        .map((b, i) => ({ b, i }))
        .filter(({ i }) => !usedBookIdx.has(i))
        .map(({ b }) => ({
            supplierGstin: b.supplierGstin,
            supplierName: b.supplierName,
            invoiceNumber: b.invoiceNumber,
            amount: b.amount,
            itc: b.itc,
        }));

    const onlyInGstr2b: ItcReconciliationRow[] = gstr2bRows
        .map((g, i) => ({ g, i }))
        .filter(({ i }) => !usedGstr2bIdx.has(i))
        .map(({ g }) => ({
            supplierGstin: g.supplierGstin,
            supplierName: g.supplierName ?? 'Unknown supplier',
            invoiceNumber: g.invoiceNumber,
            amount: g.totalAmount,
            itc:
                (g.igst ?? 0) + (g.cgst ?? 0) + (g.sgst ?? 0) + (g.cess ?? 0),
        }));

    const totalBookItc = bookRows.reduce((s, r) => s + r.itc, 0);
    const totalGstr2bItc = gstr2bRows.reduce(
        (s, g) =>
            s + (g.igst ?? 0) + (g.cgst ?? 0) + (g.sgst ?? 0) + (g.cess ?? 0),
        0,
    );
    const totalMatched = matched.reduce((s, r) => s + r.bookItc, 0);
    const totalOnlyInBooks = onlyInBooks.reduce((s, r) => s + r.itc, 0);
    const totalOnlyInGstr2b = onlyInGstr2b.reduce((s, r) => s + r.itc, 0);
    const mismatchedAmount = matched.reduce(
        (s, r) => s + Math.abs(r.bookItc - r.gstr2bItc),
        0,
    );

    return {
        period,
        matched,
        onlyInBooks,
        onlyInGstr2b,
        mismatchedAmount,
        summary: {
            totalBookItc,
            totalGstr2bItc,
            totalMatched,
            totalOnlyInBooks,
            totalOnlyInGstr2b,
        },
    };
}

/* ─── Mongo-backed wrappers ─────────────────────────────────────── */

/**
 * Compute the book-side ITC ledger for a period from `crm_bills`.
 *
 * Vendors are joined in via `$lookup` so the rows carry the supplier
 * name + GSTIN for the reconciliation view.
 */
export async function computeBookItc(
    tenantUserId: string,
    period: string,
): Promise<BookItcResult> {
    const userId = new ObjectId(tenantUserId);
    const { start, end } = periodToRange(period);

    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();

    const cursor = db.collection('crm_bills').aggregate([
        {
            $match: {
                userId,
                billDate: { $gte: start, $lte: end },
                status: { $in: Array.from(APPROVED_STATUSES) },
                $or: [{ reverseCharge: { $ne: true } }, { reverseCharge: { $exists: false } }],
            },
        },
        {
            $lookup: {
                from: 'crm_vendors',
                localField: 'vendorId',
                foreignField: '_id',
                as: 'vendor',
            },
        },
        {
            $project: {
                _id: 1,
                vendorId: 1,
                vendorInvoiceNo: 1,
                billNo: 1,
                billDate: 1,
                status: 1,
                reverseCharge: 1,
                items: 1,
                total: 1,
                totals: 1,
                vendorName: { $arrayElemAt: ['$vendor.name', 0] },
                vendorGstin: { $arrayElemAt: ['$vendor.gstin', 0] },
            },
        },
    ]);

    const bills = (await cursor.toArray()) as unknown as BillForItc[];
    return aggregateBookItc(bills, period);
}

/**
 * Reconcile book ITC against the imported GSTR-2B snapshot. Returns
 * `{ error: 'gstr2b_import_required' }` if no GSTR-2B has been imported
 * for the period yet (collection owned by §6.10a).
 */
export async function reconcileItcWithGstr2b(
    tenantUserId: string,
    period: string,
): Promise<ItcReconciliationResult | ItcReconciliationError> {
    const userId = new ObjectId(tenantUserId);
    const { start, end } = periodToRange(period);

    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();

    // Confirm a GSTR-2B import exists for the period.
    const importDoc = await db.collection('crm_gstr2b_imports').findOne({
        userId,
        period,
    });
    if (!importDoc) return { error: 'gstr2b_import_required' };

    // Load book bills (granularity = per-bill, not per-supplier).
    const bills = (await db
        .collection('crm_bills')
        .aggregate([
            {
                $match: {
                    userId,
                    billDate: { $gte: start, $lte: end },
                    status: { $in: Array.from(APPROVED_STATUSES) },
                    $or: [
                        { reverseCharge: { $ne: true } },
                        { reverseCharge: { $exists: false } },
                    ],
                },
            },
            {
                $lookup: {
                    from: 'crm_vendors',
                    localField: 'vendorId',
                    foreignField: '_id',
                    as: 'vendor',
                },
            },
            {
                $project: {
                    _id: 1,
                    vendorInvoiceNo: 1,
                    billNo: 1,
                    items: 1,
                    total: 1,
                    totals: 1,
                    vendorName: { $arrayElemAt: ['$vendor.name', 0] },
                    vendorGstin: { $arrayElemAt: ['$vendor.gstin', 0] },
                },
            },
        ])
        .toArray()) as unknown as BillForItc[];

    const bookRows = bills.map((b) => {
        const itc = sumItcFromBill(b);
        return {
            supplierGstin: (b.vendorGstin ?? null) as string | null,
            supplierName: b.vendorName ?? 'Unknown vendor',
            invoiceNumber: (b.vendorInvoiceNo ?? b.billNo ?? '').toString(),
            amount: billTotal(b),
            itc: itc.igst + itc.cgst + itc.sgst + itc.cess,
        };
    });

    const gstr2bRows = (importDoc.invoices ?? []) as Gstr2bInvoice[];

    return reconcileItc(bookRows, gstr2bRows, period);
}
