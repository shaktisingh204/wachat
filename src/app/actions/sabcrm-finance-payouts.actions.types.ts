/**
 * SabCRM Finance — payout-surface action types.
 *
 * Shared between `sabcrm-finance-payouts.actions.ts` ('use server'
 * modules may only export async functions) and the payout clients.
 * Mirrors the invoices precedent (`sabcrm-finance-invoices.actions.types.ts`).
 *
 * Payouts are the vendor-side mirror of payment receipts (spec §3.8):
 * no line items, no due date — an amount, a payment rail, a REAL picked
 * vendor + bank account, and an `applyTo[]` allocation onto open bills.
 */

import type {
  CrmPayoutMode,
  CrmPayoutStatus,
} from '@/lib/rust-client/crm-payouts';

/* ─── Status workflow ─────────────────────────────────────────── */

/** Allowed manual transitions per current status (client + action share it). */
export const SABCRM_PAYOUT_TRANSITIONS: Record<
  CrmPayoutStatus,
  CrmPayoutStatus[]
> = {
  sent: ['cleared', 'failed'],
  cleared: [],
  failed: ['sent'],
};

/** Payment rails accepted by `crm-payouts` (lowercase wire values). */
export const SABCRM_PAYOUT_MODES: { value: CrmPayoutMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'imps', label: 'IMPS' },
  { value: 'card', label: 'Card' },
  { value: 'wallet', label: 'Wallet' },
];

/** Digital rails that surface the transaction-id field. */
export const SABCRM_PAYOUT_TXN_MODES: ReadonlySet<CrmPayoutMode> = new Set([
  'upi',
  'neft',
  'rtgs',
  'imps',
  'card',
  'wallet',
]);

/* ─── Create / update (full form payloads) ────────────────────── */

/** One allocation row of the payout → bill table. */
export interface SabcrmPayoutAllocationInput {
  billId: string;
  amount: number;
}

/**
 * The full payout-form payload. The action validates the mode against
 * the crate vocabulary, requires REAL picked vendor + bank-account ids
 * (this surface never mints placeholder ObjectIds) and checks the
 * allocation sum against the amount.
 */
export interface SabcrmPayoutFullInput {
  paymentNo: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** REAL picked vendor (supply-vendors record id). Required. */
  vendorId: string;
  mode: CrmPayoutMode;
  /** REAL picked payment account. Required. */
  bankAccountId: string;
  /** Amount disbursed. Required, finite, > 0. */
  amount: number;
  currency: string;
  chequeNo?: string;
  /** `YYYY-MM-DD`. */
  chequeDate?: string;
  txnId?: string;
  reference?: string;
  /** Bill allocations — rows without a picked bill are dropped client-side. */
  applyTo?: SabcrmPayoutAllocationInput[];
  /** Park the unallocated remainder as a vendor advance. */
  excessAsAdvance?: boolean;
  /** TDS withheld at source from the vendor's payable. */
  tdsDeducted?: number;
  notes?: string;
}

/** Full-form patch — same shape, everything optional. */
export type SabcrmPayoutFullPatch = Partial<SabcrmPayoutFullInput>;

/* ─── List page / KPIs / related rail ─────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmPayoutListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmPayoutStatus | '';
  vendorId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the payout date. */
  from?: string;
  to?: string;
}

/** A display-ready list row (vendor + account already resolved). */
export interface SabcrmPayoutListRow {
  id: string;
  paymentNo: string;
  vendorId: string;
  /** Resolved vendor label, or null when the vendor no longer exists. */
  vendorLabel: string | null;
  date: string;
  mode: CrmPayoutMode;
  /** Resolved payment-account label, or null. */
  bankAccountLabel: string | null;
  amount: number;
  tdsDeducted: number;
  currency: string;
  /** Number of bills this payout was applied to. */
  appliedBills: number;
  reference: string;
  status: CrmPayoutStatus;
}

export interface SabcrmPayoutListPage {
  rows: SabcrmPayoutListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmPayoutKpis {
  /** Dominant currency among scanned payouts (formats the strip). */
  currency: string;
  /** Σ amount for payouts dated in the current month (excl. failed). */
  paidThisMonth: number;
  paidThisMonthCount: number;
  /** Σ amount still in `sent` (disbursed but not cleared). */
  unclearedTotal: number;
  unclearedCount: number;
  /** Payouts in `failed`. */
  failedCount: number;
  /** Σ tdsDeducted for the current financial year (Apr–Mar). */
  tdsWithheldFy: number;
  /** Payouts scanned. */
  count: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/** One entry in the detail page's related-documents rail. */
export interface SabcrmPayoutRelatedRef {
  kind: string;
  id: string;
  label: string;
  href: string | null;
  date?: string;
  amount?: number;
  currency?: string;
  status?: string;
  direction: 'parent' | 'child';
}

/** A resolved bill allocation for the detail rail (label, never an id). */
export interface SabcrmPayoutAllocationView {
  billId: string;
  /** Resolved bill number, or null when the bill is gone. */
  billLabel: string | null;
  amount: number;
  /** The bill's current workflow status, when resolvable. */
  billStatus?: string;
}
