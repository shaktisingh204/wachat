/**
 * SabCRM Finance — debit-note surface action types.
 *
 * Shared between `sabcrm-finance-debit-notes.actions.ts` ('use server'
 * modules may only export async functions) and the debit-note clients.
 * Vendor-side mirror of `sabcrm-finance-credit-notes.actions.types.ts`
 * for the doc-surface adopter at `/sabcrm/finance/debit-notes`
 * (finance-rollout spec §3.5).
 */

import type {
  DebitNoteReason,
  DebitNoteRefundMode,
  DebitNoteStatus,
} from '@/lib/rust-client/crm-debit-notes';
import type {
  DocLineInput,
  DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';

/* ─── Status workflow ─────────────────────────────────────────── */

/**
 * Allowed manual transitions per current status (client + action share
 * it). Identical to credit notes per the finance-rollout spec §3.5.
 */
export const SABCRM_DEBIT_NOTE_TRANSITIONS: Record<
  DebitNoteStatus,
  DebitNoteStatus[]
> = {
  draft: ['issued', 'cancelled'],
  issued: ['refunded', 'cancelled'],
  refunded: [],
  cancelled: ['draft'],
};

/* ─── Create / update (full form payloads) ────────────────────── */

/**
 * The full doc-form payload. Totals are NOT part of the input — the
 * action recomputes them from `lines` (+ header modifiers) via the
 * shared `finance-doc-math`. The Rust `CreateDebitNoteInput` round-trips
 * `items`/`totals` as passthrough JSON — the same camelCase
 * LineItem/Totals shapes are sent.
 *
 * NB: no `exchangeRate` / `attachments` on the crate's create/update
 * inputs — both render read-only on the detail page when present.
 */
export interface SabcrmDebitNoteFullInput {
  dnNo: string;
  /** REAL picked vendor (`/v1/sabcrm/supply/vendors` id). Required. */
  vendorId: string;
  currency: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** Why the debit is being raised (snake_case wire enum). Required. */
  reason: DebitNoteReason;
  /** How the value flows back — `credit` = balance held against the
   *  vendor. Required. */
  refundMode: DebitNoteRefundMode;
  /** Refund transaction reference — meaningful when `refundMode: cash`. */
  refundTxnId?: string;
  /** Parent bill this note debits (24-char hex). */
  linkedBillId?: string;
  lines: DocLineInput[];
  /** Header totals modifiers — folded into the recomputed wire totals. */
  totalsModifiers?: DocTotalsModifiersInput;
  notes?: string;
  /** Save-and-issue ⇒ the action follows up with an `issued` PATCH. */
  issue?: boolean;
  /** Optional lineage parent (defaults to the linked bill). */
  fromKind?: 'bill';
  fromId?: string;
}

/** Full-form patch — same shape, everything optional. */
export type SabcrmDebitNoteFullPatch = Partial<
  Omit<SabcrmDebitNoteFullInput, 'issue' | 'fromKind' | 'fromId'>
>;

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmDebitNoteListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: DebitNoteStatus | '';
  vendorId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the debit-note date. */
  from?: string;
  to?: string;
}

/** A display-ready list row (vendor already resolved to a label). */
export interface SabcrmDebitNoteListRow {
  id: string;
  dnNo: string;
  vendorId: string;
  /** Resolved vendor label, or null when the vendor no longer exists. */
  vendorLabel: string | null;
  date: string;
  reason: DebitNoteReason;
  refundMode: DebitNoteRefundMode;
  currency: string;
  total: number;
  status: DebitNoteStatus;
  linkedBillId: string | null;
}

export interface SabcrmDebitNoteListPage {
  rows: SabcrmDebitNoteListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmDebitNoteKpis {
  /** Dominant currency among scanned notes (formats the strip). */
  currency: string;
  /** Σ totals.total over issued + refunded notes. */
  debitedTotal: number;
  /** Σ totals.total over issued notes with `refundMode: cash`. */
  refundsPendingAmount: number;
  /** Issued notes with `refundMode: cash` awaiting a vendor refund. */
  refundsPendingCount: number;
  /** Σ totals.total for notes dated in the current month (excl. cancelled). */
  thisMonthTotal: number;
  thisMonthCount: number;
  /** Most frequent reason across scanned notes (null when empty). */
  topReason: DebitNoteReason | null;
  topReasonCount: number;
  /** Notes scanned. */
  count: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/* ─── Prefill (bill → debit note deep link) ───────────────────── */

/** Seed handed to the create form by `?fromBill=<id>` deep links. */
export interface SabcrmDebitNotePrefill {
  billId: string;
  /** Bill number — the linked-bill picker's display label. */
  billLabel: string;
  vendorId: string;
  /** Resolved vendor label (null when the vendor is gone). */
  vendorLabel: string | null;
  currency: string;
}
