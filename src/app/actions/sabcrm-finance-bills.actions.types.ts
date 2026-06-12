/**
 * SabCRM Finance — bill surface action types.
 *
 * Shared between `sabcrm-finance-bills.actions.ts` ('use server'
 * modules may only export async functions) and the bill clients.
 * Mirrors the `sabcrm-finance-invoices.actions.types.ts` convention for
 * the doc-surface adopter at `/sabcrm/finance/bills` (finance-rollout
 * spec §3.6).
 */

import type { CrmBillStatus } from '@/lib/rust-client/crm-bills';
import type { CrmPayoutMode } from '@/lib/rust-client/crm-payouts';
import type {
  DocLineInput,
  DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';

/* ─── Status workflow ─────────────────────────────────────────── */

/**
 * Allowed MANUAL transitions per current status (client + action share
 * it). `paid` / `partially_paid` are otherwise driven by payouts
 * (`recordSabcrmBillPayout`); `overdue` can also be set manually from
 * `approved`. Mirrors the finance-rollout spec §3.6 exactly.
 */
export const SABCRM_BILL_TRANSITIONS: Record<CrmBillStatus, CrmBillStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'cancelled'],
  approved: ['overdue', 'cancelled'],
  partially_paid: ['cancelled'],
  overdue: ['cancelled'],
  paid: [],
  cancelled: ['draft'],
};

/** Statuses on which a bill can still receive payouts. */
export const SABCRM_BILL_PAYABLE_STATUSES: readonly CrmBillStatus[] = [
  'approved',
  'partially_paid',
  'overdue',
];

/** Open (outstanding) statuses for KPI / aging math. */
export const SABCRM_BILL_OPEN_STATUSES: readonly CrmBillStatus[] = [
  'submitted',
  'approved',
  'partially_paid',
  'overdue',
];

/* ─── Create / update (full form payloads) ────────────────────── */

/**
 * One direct-to-ledger expense line (service / utility / rent bills).
 * Mirrors `crm_purchases_types::bill::ExpenseLine`'s exposed subset.
 */
export interface SabcrmBillExpenseLineInput {
  /** Chart-of-accounts id (24-char hex) — picked, never minted. */
  accountId?: string;
  description?: string;
  /** Pre-tax amount, > 0. */
  amount: number;
  /** Tax %, ≥ 0 — folded into the recomputed totals. */
  taxRatePct?: number;
}

/**
 * The full doc-form payload. Totals are NOT part of the input — the
 * action recomputes them from `lines` + `expenseLines` (+ header
 * modifiers) so the client can never save inconsistent money. A bill
 * must carry at least one item line OR one expense line.
 *
 * Server-managed (never sent): `amountPaid`, `balance`, `linkedPoId`,
 * `linkedGrnIds`, `lineage`. `billNo` is immutable after create (the AP
 * audit trail relies on stable doc numbers).
 */
export interface SabcrmBillFullInput {
  /** Internal bill number (suggested `BILL-…`; the form requires one). */
  billNo?: string;
  /** The vendor's own invoice number, as printed on their document. */
  vendorInvoiceNo?: string;
  /** REAL picked vendor (`/v1/sabcrm/supply/vendors` id). Required. */
  vendorId: string;
  currency: string;
  /** Optional FX rate to the base currency. */
  exchangeRate?: number;
  /** `YYYY-MM-DD`. */
  billDate: string;
  /** `YYYY-MM-DD` — optional (drives AP aging when present). */
  dueDate?: string;
  /** Inventory-line items (goods bills). */
  lines: DocLineInput[];
  /** Header totals modifiers over the item lines. */
  totalsModifiers?: DocTotalsModifiersInput;
  /** Direct-to-ledger expense lines (service / overhead bills). */
  expenseLines?: SabcrmBillExpenseLineInput[];
  /** TDS section code (e.g. "194C", "194J"). */
  tdsSection?: string;
  /** Withholding amount deducted from the vendor payout. */
  tdsAmount?: number;
  /** GST reverse-charge flag. */
  reverseCharge?: boolean;
  placeOfSupply?: string;
  notes?: string;
  /** Save-and-submit ⇒ the action follows up with a `submitted` PATCH. */
  issue?: boolean;
  /** Optional lineage parent. Whitelisted on the Rust side. */
  fromKind?: 'purchaseOrder' | 'grn';
  fromId?: string;
}

/** Full-form patch — `billNo` is immutable, everything else optional. */
export type SabcrmBillFullPatch = Partial<
  Omit<SabcrmBillFullInput, 'billNo' | 'issue' | 'fromKind' | 'fromId'>
>;

/* ─── Payouts (record-payout dialog) ──────────────────────────── */

/** "Record payout" dialog payload (mirrors the invoice payment shape). */
export interface SabcrmBillPayoutInput {
  /** Amount paid out. Required, finite, > 0. */
  amount: number;
  /** Payout date, `YYYY-MM-DD`. */
  date: string;
  mode: CrmPayoutMode;
  /** REAL payment-account id — picked, never minted. Required. */
  bankAccountId: string;
  reference?: string;
  /** TDS withheld from this payout (optional). */
  tdsDeducted?: number;
  notes?: string;
}

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmBillListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmBillStatus | '';
  vendorId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the bill date. */
  from?: string;
  to?: string;
}

/** A display-ready list row (vendor already resolved to a label). */
export interface SabcrmBillListRow {
  id: string;
  /** Display number: `billNo`, falling back to `vendorInvoiceNo`. */
  number: string;
  billNo: string | null;
  vendorInvoiceNo: string | null;
  vendorId: string;
  /** Resolved vendor label, or null when the vendor no longer exists. */
  vendorLabel: string | null;
  billDate: string;
  dueDate: string | null;
  currency: string;
  total: number;
  amountPaid: number;
  /** Outstanding balance (0 once the bill is `paid`). */
  balance: number;
  status: CrmBillStatus;
  /** Days past due (positive ⇒ overdue) for open bills, else null. */
  agingDays: number | null;
}

export interface SabcrmBillListPage {
  rows: SabcrmBillListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmBillKpis {
  /** Dominant currency among scanned bills (formats the strip). */
  currency: string;
  /** Σ balance over open (submitted/approved/partially_paid/overdue) bills. */
  outstanding: number;
  /** Open bills past their due date. */
  overdueCount: number;
  /** Open bills due within the next 7 days. */
  dueSoonCount: number;
  /** Σ balance of those due-soon bills. */
  dueSoonAmount: number;
  /** Σ totals.total for bills dated in the current month (excl. cancelled). */
  thisMonthTotal: number;
  thisMonthCount: number;
  /** Bills scanned. */
  count: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}
