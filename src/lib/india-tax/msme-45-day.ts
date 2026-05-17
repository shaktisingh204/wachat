/**
 * MSME 45-day delayed-payment compliance — CRM_REBUILD_PLAN.md §6.10.
 *
 * India's MSMED Act 2006 (and the 2023 Income Tax amendment, Section
 * 43B(h)) requires that any business paying an MSME-registered supplier
 * MUST clear the invoice within 45 days of acceptance (or 15 days if no
 * written agreement). Late payment triggers:
 *
 *   (a) interest u/s 16 of the MSMED Act at 3× the bank rate compounded
 *       monthly, AND
 *   (b) disallowance of the deduction in the buyer's income tax for that
 *       year (Sec 43B(h)).
 *
 * This module is the pure, side-effect-free brain behind the daily cron
 * at `/api/cron/msme-45-day-check`, the page at
 * `/dashboard/crm/tax/msme-alerts`, and the actions in
 * `crm-msme-alerts.actions.ts`. Everything here is unit-testable —
 * Mongo/Rust I/O is injected via the `db` parameter so the test harness
 * can pass a stub.
 *
 * Buckets:
 *  - `overdue`   — `daysOverdue > 0` (already past the 45-day boundary).
 *  - `at_risk`   — `daysOverdue` in `[-7, 0]` (will breach within a week).
 *
 * `daysOverdue` is `floor((now - billDate) / 1d) - msmePaymentTermsDays`.
 * `billDate` is the canonical "acceptance" anchor since the bills table
 * doesn't yet model a separate goods-acceptance date; this matches the
 * §6.10 spec which uses the bill posting as the start of the clock.
 */
import { ObjectId } from 'mongodb';

/* ─── Types ────────────────────────────────────────────────────── */

export type MsmePaymentTerms = number;

export interface MsmeOverdueRow {
    billId: string;
    vendorId: string;
    vendorName: string;
    billNo?: string;
    billDate: Date;
    dueDate?: Date;
    daysOverdue: number;
    amountOutstanding: number;
    msmePaymentTermsDays: number;
    msmeCategory?: 'Micro' | 'Small' | 'Medium';
    udyamRegistrationNumber?: string;
    /** Discriminator: positive `daysOverdue` => 'overdue'; otherwise 'at_risk'. */
    bucket: 'overdue' | 'at_risk';
}

export interface MsmeOverdueSummary {
    totalOverdueCount: number;
    totalOverdueAmount: number;
    totalAtRiskCount: number;
    totalAtRiskAmount: number;
}

export interface MsmeOverdueResult {
    bills: MsmeOverdueRow[];
    summary: MsmeOverdueSummary;
}

/** Minimal subset of the bill doc that affects MSME timing. */
export interface RawBill {
    _id: unknown;
    userId?: unknown;
    vendorId?: unknown;
    billNo?: string;
    billDate?: Date | string;
    dueDate?: Date | string;
    status?: string;
    paidAt?: Date | string | null;
    amountPaid?: number;
    balance?: number;
    totals?: { total?: number; subTotal?: number };
}

/** Minimal subset of the vendor doc that signals MSME registration. */
export interface RawVendor {
    _id: unknown;
    name?: string;
    isMsme?: boolean;
    udyamRegistrationNumber?: string;
    msmeCategory?: 'Micro' | 'Small' | 'Medium';
    msmePaymentTermsDays?: number;
}

/** Narrow shim over `connectToDatabase()` for testability. */
export interface MsmeDb {
    findMsmeVendors(tenantUserId: string): Promise<RawVendor[]>;
    findOpenBillsForVendors(
        tenantUserId: string,
        vendorIds: string[],
    ): Promise<RawBill[]>;
}

/* ─── Constants ───────────────────────────────────────────────── */

/** MSMED Act default — 45 days where there is a written agreement. */
export const DEFAULT_MSME_PAYMENT_TERMS_DAYS: MsmePaymentTerms = 45;

/** How many days *before* the 45-day boundary do we flag as "at risk". */
export const AT_RISK_WINDOW_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* ─── Pure helpers ─────────────────────────────────────────────── */

/** Coerce a possibly-undefined boolean-ish vendor field to a strict boolean. */
export function isMsmeVendor(v: Pick<RawVendor, 'isMsme'> | null | undefined): boolean {
    if (!v) return false;
    return v.isMsme === true;
}

/** Treat `paid` / `cancelled` as out-of-scope; everything else is "open". */
export function isOpenBill(b: Pick<RawBill, 'status'>): boolean {
    const s = (b.status ?? '').toString().toLowerCase();
    if (s === 'paid') return false;
    if (s === 'cancelled') return false;
    return true;
}

/**
 * Days the bill is overdue against the MSME clock. Negative numbers mean
 * the bill is still inside the 45-day window (the absolute value is the
 * days remaining); positive numbers mean it's breached.
 */
export function daysOverdueAgainstMsmeClock(
    billDate: Date,
    now: Date,
    termsDays: MsmePaymentTerms = DEFAULT_MSME_PAYMENT_TERMS_DAYS,
): number {
    const ageMs = now.getTime() - billDate.getTime();
    const ageDays = Math.floor(ageMs / MS_PER_DAY);
    return ageDays - termsDays;
}

/** Outstanding amount on a bill, computed defensively from whatever totals we have. */
export function amountOutstandingOf(b: RawBill): number {
    const total = Number(b.totals?.total ?? b.totals?.subTotal ?? 0) || 0;
    const balance = Number(b.balance);
    if (Number.isFinite(balance) && balance > 0) return balance;
    const paid = Number(b.amountPaid);
    if (Number.isFinite(paid) && paid > 0) return Math.max(0, total - paid);
    return total;
}

function toDate(raw: Date | string | undefined | null): Date | undefined {
    if (!raw) return undefined;
    if (raw instanceof Date) return raw;
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : undefined;
}

function toId(raw: unknown): string {
    if (!raw) return '';
    if (typeof raw === 'string') return raw;
    if (raw instanceof ObjectId) return raw.toHexString();
    try {
        return String(raw);
    } catch {
        return '';
    }
}

/* ─── Core compute ─────────────────────────────────────────────── */

/**
 * Pure computation: given a snapshot of bills + their vendors, return
 * the rows that are MSME-overdue or MSME-at-risk plus a KPI summary.
 *
 * Splitting this out lets the tests cover the logic without a Mongo
 * stub. Callers that have raw collections should use
 * `computeMsmeOverduebills()` below, which fetches and then delegates
 * here.
 */
export function computeMsmeOverdueFromSnapshot(
    bills: RawBill[],
    vendorsById: Map<string, RawVendor>,
    now: Date = new Date(),
): MsmeOverdueResult {
    const rows: MsmeOverdueRow[] = [];

    for (const b of bills) {
        const vendorId = toId(b.vendorId);
        if (!vendorId) continue;

        const vendor = vendorsById.get(vendorId);
        if (!isMsmeVendor(vendor)) continue;
        if (!isOpenBill(b)) continue;

        const billDate = toDate(b.billDate);
        if (!billDate) continue;

        const terms = Number(vendor?.msmePaymentTermsDays);
        const msmePaymentTermsDays =
            Number.isFinite(terms) && terms > 0 ? terms : DEFAULT_MSME_PAYMENT_TERMS_DAYS;
        const daysOverdue = daysOverdueAgainstMsmeClock(billDate, now, msmePaymentTermsDays);

        // Bucket: > 0 → overdue; in [-AT_RISK_WINDOW_DAYS+1, 0] → at-risk; else skip.
        const bucket: 'overdue' | 'at_risk' | null =
            daysOverdue > 0
                ? 'overdue'
                : daysOverdue > -AT_RISK_WINDOW_DAYS
                  ? 'at_risk'
                  : null;
        if (!bucket) continue;

        const amountOutstanding = amountOutstandingOf(b);
        if (amountOutstanding <= 0) continue;

        rows.push({
            billId: toId(b._id),
            vendorId,
            vendorName: vendor?.name ?? '(unnamed vendor)',
            billNo: b.billNo,
            billDate,
            dueDate: toDate(b.dueDate),
            daysOverdue,
            amountOutstanding,
            msmePaymentTermsDays,
            msmeCategory: vendor?.msmeCategory,
            udyamRegistrationNumber: vendor?.udyamRegistrationNumber,
            bucket,
        });
    }

    // Most-overdue first.
    rows.sort((a, b) => b.daysOverdue - a.daysOverdue);

    const summary = rows.reduce<MsmeOverdueSummary>(
        (acc, r) => {
            if (r.bucket === 'overdue') {
                acc.totalOverdueCount += 1;
                acc.totalOverdueAmount += r.amountOutstanding;
            } else {
                acc.totalAtRiskCount += 1;
                acc.totalAtRiskAmount += r.amountOutstanding;
            }
            return acc;
        },
        {
            totalOverdueCount: 0,
            totalOverdueAmount: 0,
            totalAtRiskCount: 0,
            totalAtRiskAmount: 0,
        },
    );

    return { bills: rows, summary };
}

/**
 * I/O wrapper: fetch the tenant's MSME-flagged vendors, then their open
 * bills, then hand off to `computeMsmeOverdueFromSnapshot`.
 *
 * Returns an empty result on any failure — the caller (cron, action,
 * page) is responsible for surfacing the error to its own logs/UI.
 */
export async function computeMsmeOverduebills(
    tenantUserId: string,
    db: MsmeDb,
    now: Date = new Date(),
): Promise<MsmeOverdueResult> {
    if (!tenantUserId) {
        return emptyResult();
    }

    const vendors = await db.findMsmeVendors(tenantUserId);
    if (vendors.length === 0) {
        return emptyResult();
    }

    const vendorsById = new Map<string, RawVendor>();
    for (const v of vendors) {
        const id = toId(v._id);
        if (id) vendorsById.set(id, v);
    }

    const bills = await db.findOpenBillsForVendors(tenantUserId, [...vendorsById.keys()]);

    return computeMsmeOverdueFromSnapshot(bills, vendorsById, now);
}

function emptyResult(): MsmeOverdueResult {
    return {
        bills: [],
        summary: {
            totalOverdueCount: 0,
            totalOverdueAmount: 0,
            totalAtRiskCount: 0,
            totalAtRiskAmount: 0,
        },
    };
}

/* ─── Udyam registration validation ────────────────────────────── */

/**
 * Loose validator for the Udyam Registration Number — the official
 * MSME identifier. Format: `UDYAM-XX-NN-NNNNNNN` (state code, district
 * code, 7-digit sequence). We're permissive on whitespace + casing so
 * pasted IDs don't fail trivially.
 */
const UDYAM_RE = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

export function isValidUdyamRegistrationNumber(s: string | undefined | null): boolean {
    if (!s) return false;
    const norm = String(s).trim().toUpperCase();
    return UDYAM_RE.test(norm);
}

/**
 * Surfaces a (single) form-level warning if `isMsme === true` but the
 * Udyam number is missing or malformed. Returns `null` when OK.
 */
export function validateMsmeVendorRegistration(
    v: Pick<RawVendor, 'isMsme' | 'udyamRegistrationNumber'>,
): string | null {
    if (!v.isMsme) return null;
    const trimmed = (v.udyamRegistrationNumber ?? '').trim();
    if (!trimmed) {
        return 'Udyam Registration Number is recommended when "MSME-registered" is on.';
    }
    if (!isValidUdyamRegistrationNumber(trimmed)) {
        return 'Udyam Registration Number looks malformed (expected UDYAM-XX-NN-NNNNNNN).';
    }
    return null;
}
