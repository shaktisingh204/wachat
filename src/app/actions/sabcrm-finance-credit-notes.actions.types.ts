/**
 * SabCRM Finance — credit-note surface action types.
 *
 * Shared between `sabcrm-finance-credit-notes.actions.ts` ('use server'
 * modules may only export async functions) and the credit-note clients.
 * Mirrors the `sabcrm-finance-invoices.actions.types.ts` convention for
 * the doc-surface adopter at `/sabcrm/finance/credit-notes`
 * (finance-rollout spec §3.4).
 */

import type {
  CreditNoteReason,
  CreditNoteStatus,
  RefundMode,
} from '@/lib/rust-client/crm-credit-notes';
import type {
  DocLineInput,
  DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';
import type { SabcrmPartyObjectSlug } from './sabcrm-finance-invoices.actions.types';

/* ─── Status workflow ─────────────────────────────────────────── */

/**
 * Allowed manual transitions per current status (client + action share
 * it). `refunded` is terminal; a cancelled note can be reopened as a
 * draft. Mirrors the finance-rollout spec §3.4 exactly.
 */
export const SABCRM_CREDIT_NOTE_TRANSITIONS: Record<
  CreditNoteStatus,
  CreditNoteStatus[]
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
 * shared `finance-doc-math` so the client can never save inconsistent
 * money.
 *
 * NB: the Rust `CreateCreditNoteInput` carries no `exchangeRate` and no
 * `attachments` — both render read-only on the detail page when present
 * on legacy documents (engine DTO gap, see the actions module docs).
 */
export interface SabcrmCreditNoteFullInput {
  cnNo: string;
  /** REAL picked party (records-engine record id). Required. */
  clientId: string;
  currency: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** Why the credit is being issued (snake_case wire enum). Required. */
  reason: CreditNoteReason;
  /** How the credit flows back (lowercase wire enum). Required. */
  refundMode: RefundMode;
  /** Refund transaction reference — meaningful when `refundMode: cash`. */
  refundTxnId?: string;
  /** Recompute taxes from line rates on the engine side. */
  taxRecalc?: boolean;
  /** Auto-apply the credit to the customer's next invoice. */
  autoApply?: boolean;
  /** Parent invoice this note credits (24-char hex). */
  linkedInvoiceId?: string;
  lines: DocLineInput[];
  /** Header totals modifiers — folded into the recomputed wire totals. */
  totalsModifiers?: DocTotalsModifiersInput;
  notes?: string;
  /** Save-and-issue ⇒ the action follows up with an `issued` PATCH. */
  issue?: boolean;
  /** Optional lineage parent (defaults to the linked invoice). */
  fromKind?: 'invoice';
  fromId?: string;
}

/** Full-form patch — same shape, everything optional. */
export type SabcrmCreditNoteFullPatch = Partial<
  Omit<SabcrmCreditNoteFullInput, 'issue' | 'fromKind' | 'fromId'>
>;

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmCreditNoteListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: CreditNoteStatus | '';
  clientId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the credit-note date. */
  from?: string;
  to?: string;
}

/** A display-ready list row (party already resolved to a label). */
export interface SabcrmCreditNoteListRow {
  id: string;
  cnNo: string;
  partyId: string;
  /** Resolved customer label, or null when the record no longer exists. */
  partyLabel: string | null;
  partyObjectSlug: SabcrmPartyObjectSlug | null;
  date: string;
  reason: CreditNoteReason;
  refundMode: RefundMode;
  currency: string;
  total: number;
  status: CreditNoteStatus;
  linkedInvoiceId: string | null;
}

export interface SabcrmCreditNoteListPage {
  rows: SabcrmCreditNoteListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmCreditNoteKpis {
  /** Dominant currency among scanned notes (formats the strip). */
  currency: string;
  /** Σ totals.total over issued + refunded notes. */
  creditedTotal: number;
  /** Σ totals.total over issued notes with `refundMode: cash`. */
  refundsPendingAmount: number;
  /** Issued notes with `refundMode: cash` awaiting a refund. */
  refundsPendingCount: number;
  /** Σ totals.total for notes dated in the current month (excl. cancelled). */
  thisMonthTotal: number;
  thisMonthCount: number;
  /** Most frequent reason across scanned notes (null when empty). */
  topReason: CreditNoteReason | null;
  topReasonCount: number;
  /** Notes scanned. */
  count: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/* ─── Prefill (invoice → credit note deep link) ───────────────── */

/** Seed handed to the create form by `?fromInvoice=<id>` deep links. */
export interface SabcrmCreditNotePrefill {
  invoiceId: string;
  /** Invoice number — the linked-invoice picker's display label. */
  invoiceLabel: string;
  clientId: string;
  /** Resolved customer label (null when the record is gone). */
  clientLabel: string | null;
  currency: string;
}
