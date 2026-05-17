/**
 * §6.10 TDS u/s 194Q tracker (pure logic + Mongo wrappers).
 *
 * Section 194Q (Income-tax Act): the buyer must deduct 0.1% TDS when
 *  - the buyer's prior-financial-year turnover exceeds ₹10 cr, AND
 *  - annual purchases from a single seller exceed ₹50 lakh
 * The TDS applies only to the amount EXCEEDING ₹50 lakh per seller per
 * FY. Triggered at the BUYER side (contrast with TCS u/s 206C(1H)
 * which is seller-side).
 *
 * This module never auto-deducts. It surfaces what SHOULD be deducted
 * so a finance user can click "Record deduction" to actually persist
 * the TDS row.
 *
 * Pure aggregation lives in `evaluateApplicabilityFromTotals` and
 * `aggregateVendorPurchases` so they're unit-testable. The exported
 * Mongo wrappers (`evaluateTds194qApplicability`,
 * `trackVendorPurchases`, `recordTds194qDeduction`) thread these
 * through `connectToDatabase()`.
 */

import { ObjectId } from 'mongodb';

/* ─── Constants ─────────────────────────────────────────────────── */

/** Prior-year turnover threshold — ₹10 crore. */
export const TURNOVER_THRESHOLD_INR = 10_00_00_000;
/** Per-vendor purchase threshold — ₹50 lakh. */
export const VENDOR_THRESHOLD_INR = 50_00_000;
/** Statutory TDS rate u/s 194Q — 0.1 %. */
export const TDS_194Q_RATE = 0.001;

/* ─── Types ─────────────────────────────────────────────────────── */

export interface Tds194qApplicability {
    applicable: boolean;
    reason: string;
    priorYearTurnover: number;
    threshold: number;
    /** The FY used for the turnover check — i.e. (target FY − 1). */
    priorFinancialYear: string;
}

export type VendorTrackerStatus =
    | 'threshold_not_crossed'
    | 'deduct_on_next_bill'
    | 'deducted';

export interface VendorTrackerRow {
    vendorId: string;
    vendorName: string;
    gstin: string | null;
    totalPurchases: number;
    /** max(0, totalPurchases - ₹50 lakh) — what 0.1% applies to. */
    deductibleAmount: number;
    tdsToDeduct: number;
    tdsDeducted: number;
    status: VendorTrackerStatus;
}

export interface VendorTrackerResult {
    financialYear: string;
    byVendor: VendorTrackerRow[];
}

/* ─── FY helpers ────────────────────────────────────────────────── */

/**
 * Parse `"YYYY-YY"` (e.g. `"2026-27"`) into the calendar window for
 * the Indian financial year (Apr 1 → Mar 31).
 */
export function parseFyToRange(fy: string): { start: Date; end: Date } | null {
    const m = fy.match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const startYear = Number(m[1]);
    // FY 2026-27 starts Apr 2026, ends Mar 2027.
    const start = new Date(startYear, 3, 1); // Apr 1
    const end = new Date(startYear + 1, 2, 31, 23, 59, 59, 999); // Mar 31
    return { start, end };
}

/** Return `"YYYY-YY"` for the FY immediately prior to `fy`. */
export function previousFy(fy: string): string {
    const m = fy.match(/^(\d{4})-(\d{2})$/);
    if (!m) return fy;
    const s = Number(m[1]);
    const e = Number(m[2]);
    const ps = (s - 1).toString();
    const pe = (e - 1).toString().padStart(2, '0');
    return `${ps}-${pe}`;
}

/* ─── Pure aggregators ──────────────────────────────────────────── */

/**
 * Decide §194Q applicability given the buyer's prior-year invoice
 * total. Returns the structured `{ applicable, reason }` shape the UI
 * renders directly.
 */
export function evaluateApplicabilityFromTotals(
    priorYearTurnover: number,
    targetFinancialYear: string,
): Tds194qApplicability {
    const priorFinancialYear = previousFy(targetFinancialYear);
    if (priorYearTurnover > TURNOVER_THRESHOLD_INR) {
        return {
            applicable: true,
            reason: `Prior FY (${priorFinancialYear}) turnover ₹${priorYearTurnover.toLocaleString('en-IN')} exceeds the ₹10 cr threshold — §194Q applies for FY ${targetFinancialYear}.`,
            priorYearTurnover,
            threshold: TURNOVER_THRESHOLD_INR,
            priorFinancialYear,
        };
    }
    return {
        applicable: false,
        reason: `Prior FY (${priorFinancialYear}) turnover ₹${priorYearTurnover.toLocaleString('en-IN')} is at or below the ₹10 cr threshold — §194Q does not apply.`,
        priorYearTurnover,
        threshold: TURNOVER_THRESHOLD_INR,
        priorFinancialYear,
    };
}

interface VendorAggInput {
    vendorId: string;
    vendorName: string;
    gstin: string | null;
    totalPurchases: number;
    tdsAlreadyDeducted: number;
}

/**
 * Apply the §194Q math to a per-vendor purchase aggregate. Pure — the
 * caller is responsible for sourcing `totalPurchases` and
 * `tdsAlreadyDeducted` from Mongo.
 */
export function applyVendorRule(input: VendorAggInput): VendorTrackerRow {
    const deductibleAmount = Math.max(0, input.totalPurchases - VENDOR_THRESHOLD_INR);
    const tdsToDeduct = deductibleAmount * TDS_194Q_RATE;
    let status: VendorTrackerStatus;
    if (deductibleAmount === 0) {
        status = 'threshold_not_crossed';
    } else if (input.tdsAlreadyDeducted >= tdsToDeduct - 1) {
        // ±1 INR slack for rounding skew on the persisted side.
        status = 'deducted';
    } else {
        status = 'deduct_on_next_bill';
    }
    return {
        vendorId: input.vendorId,
        vendorName: input.vendorName,
        gstin: input.gstin,
        totalPurchases: input.totalPurchases,
        deductibleAmount,
        tdsToDeduct,
        tdsDeducted: input.tdsAlreadyDeducted,
        status,
    };
}

/**
 * Aggregate a list of vendor inputs through `applyVendorRule`, sorted
 * by descending purchases.
 */
export function aggregateVendorPurchases(
    inputs: VendorAggInput[],
    financialYear: string,
): VendorTrackerResult {
    return {
        financialYear,
        byVendor: inputs
            .map(applyVendorRule)
            .sort((a, b) => b.totalPurchases - a.totalPurchases),
    };
}

/* ─── Mongo wrappers ────────────────────────────────────────────── */

/**
 * Sum `crm_invoices` totals for the prior FY to determine applicability.
 * Errs on the side of false (non-applicable) when no invoices exist.
 */
export async function evaluateTds194qApplicability(
    tenantUserId: string,
    financialYear: string,
): Promise<Tds194qApplicability> {
    const priorFy = previousFy(financialYear);
    const range = parseFyToRange(priorFy);
    if (!range) {
        return {
            applicable: false,
            reason: `Could not parse financial year "${financialYear}".`,
            priorYearTurnover: 0,
            threshold: TURNOVER_THRESHOLD_INR,
            priorFinancialYear: priorFy,
        };
    }

    const userId = new ObjectId(tenantUserId);
    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();

    const agg = await db
        .collection('crm_invoices')
        .aggregate([
            {
                $match: {
                    userId,
                    invoiceDate: { $gte: range.start, $lte: range.end },
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ['$total', { $ifNull: ['$totals.total', 0] }] } },
                },
            },
        ])
        .toArray();

    const priorYearTurnover = (agg[0] as { total?: number } | undefined)?.total ?? 0;
    return evaluateApplicabilityFromTotals(priorYearTurnover, financialYear);
}

/**
 * Aggregate bill totals per vendor for the FY, join the vendor master,
 * subtract any TDS already deducted u/s 194Q against the buyer's
 * `crm_tds_records` for the same FY.
 */
export async function trackVendorPurchases(
    tenantUserId: string,
    financialYear: string,
): Promise<VendorTrackerResult> {
    const range = parseFyToRange(financialYear);
    if (!range) return { financialYear, byVendor: [] };

    const userId = new ObjectId(tenantUserId);
    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();

    const billAgg = (await db
        .collection('crm_bills')
        .aggregate([
            {
                $match: {
                    userId,
                    billDate: { $gte: range.start, $lte: range.end },
                    status: { $nin: ['cancelled', 'draft', 'Cancelled', 'Draft'] },
                },
            },
            {
                $group: {
                    _id: '$vendorId',
                    totalPurchases: {
                        $sum: { $ifNull: ['$total', { $ifNull: ['$totals.total', 0] }] },
                    },
                },
            },
            {
                $lookup: {
                    from: 'crm_vendors',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'vendor',
                },
            },
            {
                $project: {
                    vendorId: '$_id',
                    totalPurchases: 1,
                    vendorName: { $arrayElemAt: ['$vendor.name', 0] },
                    gstin: { $arrayElemAt: ['$vendor.gstin', 0] },
                },
            },
        ])
        .toArray()) as Array<{
        vendorId: ObjectId | null;
        totalPurchases: number;
        vendorName?: string;
        gstin?: string | null;
    }>;

    // Look up TDS already deducted u/s 194Q for the FY, grouped by
    // vendor. Stored on the same `crm_tds_records` collection — section
    // is the discriminator.
    const tdsAgg = (await db
        .collection('crm_tds_records')
        .aggregate([
            {
                $match: {
                    userId,
                    financialYear,
                    section: '194Q',
                    status: { $ne: 'archived' },
                },
            },
            {
                $group: {
                    _id: '$vendorId',
                    tdsAlreadyDeducted: { $sum: { $ifNull: ['$tdsAmount', 0] } },
                },
            },
        ])
        .toArray()) as Array<{
        _id: ObjectId | string | null;
        tdsAlreadyDeducted: number;
    }>;

    const tdsByVendor = new Map<string, number>();
    for (const r of tdsAgg) {
        if (!r._id) continue;
        tdsByVendor.set(r._id.toString(), r.tdsAlreadyDeducted);
    }

    const inputs: VendorAggInput[] = billAgg
        .filter((r) => r.vendorId != null)
        .map((r) => ({
            vendorId: r.vendorId!.toString(),
            vendorName: r.vendorName ?? 'Unknown vendor',
            gstin: r.gstin ?? null,
            totalPurchases: r.totalPurchases,
            tdsAlreadyDeducted: tdsByVendor.get(r.vendorId!.toString()) ?? 0,
        }));

    return aggregateVendorPurchases(inputs, financialYear);
}

/**
 * Persist a §194Q deduction against a bill — writes to
 * `crm_tds_records` with `section: '194Q'`.
 */
export async function recordTds194qDeduction(
    tenantUserId: string,
    billId: string,
    amount: number,
): Promise<{ id: string }> {
    if (!ObjectId.isValid(tenantUserId)) {
        throw new Error('Invalid tenant id.');
    }
    if (!ObjectId.isValid(billId)) {
        throw new Error('Invalid bill id.');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('TDS amount must be a positive number.');
    }

    const userId = new ObjectId(tenantUserId);
    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();

    const bill = await db.collection('crm_bills').findOne({
        _id: new ObjectId(billId),
        userId,
    });
    if (!bill) throw new Error('Bill not found.');

    const billDate = bill.billDate ? new Date(bill.billDate) : new Date();
    const fyStartYear =
        billDate.getMonth() >= 3 ? billDate.getFullYear() : billDate.getFullYear() - 1;
    const financialYear = `${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`;
    const quarter = quarterFromMonth(billDate.getMonth());

    let vendorName = 'Unknown vendor';
    if (bill.vendorId) {
        const vendor = await db.collection('crm_vendors').findOne({
            _id: bill.vendorId,
            userId,
        });
        if (vendor?.name) vendorName = vendor.name as string;
    }

    const now = new Date();
    const result = await db.collection('crm_tds_records').insertOne({
        userId,
        section: '194Q',
        billId: new ObjectId(billId),
        vendorId: bill.vendorId ?? null,
        vendorName,
        // Reuse the existing employeeName field so the legacy HR drill
        // view still renders gracefully if it picks this row up.
        employeeName: vendorName,
        financialYear,
        quarter,
        tdsAmount: amount,
        grossAmount: bill.totals?.total ?? bill.total ?? 0,
        status: 'pending',
        notes: `Auto-recorded against bill ${bill.billNo ?? bill.vendorInvoiceNo ?? billId}.`,
        createdAt: now,
        updatedAt: now,
    });

    return { id: result.insertedId.toString() };
}

function quarterFromMonth(monthZeroIdx: number): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
    // Indian FY: Apr-Jun=Q1, Jul-Sep=Q2, Oct-Dec=Q3, Jan-Mar=Q4
    if (monthZeroIdx >= 3 && monthZeroIdx <= 5) return 'Q1';
    if (monthZeroIdx >= 6 && monthZeroIdx <= 8) return 'Q2';
    if (monthZeroIdx >= 9 && monthZeroIdx <= 11) return 'Q3';
    return 'Q4';
}
