/**
 * SabCRM Finance — journal-entries (voucher entries) action types.
 *
 * Shared between `sabcrm-finance-journal-entries.actions.ts` ('use
 * server' modules may only export async functions) and the
 * `/sabcrm/finance/journal-entries` doc-surface client. Mirrors the
 * `sabcrm-finance-invoices.actions.types.ts` convention; the wire
 * shape is `crm-voucher-entries::CrmVoucherEntry` (crm-common style,
 * 0-indexed list pagination — the actions translate the kit's 1-based
 * pages).
 */

import type { CrmVoucherEntryStatus } from '@/lib/rust-client/crm-voucher-entries';

/* ─── Status workflow ─────────────────────────────────────────── */

/**
 * Allowed manual transitions per current status. Posted entries are
 * immutable (accounting rule) — they can only be archived via delete.
 */
export const SABCRM_JOURNAL_ENTRY_TRANSITIONS: Record<
  CrmVoucherEntryStatus,
  CrmVoucherEntryStatus[]
> = {
  draft: ['posted'],
  posted: [],
  archived: [],
};

/* ─── Legs ────────────────────────────────────────────────────── */

/** One debit/credit leg as submitted by the form. */
export interface SabcrmJournalLegInput {
  /** REAL chart-of-accounts id — picked, never minted. */
  accountId: string;
  /** Positive amount. */
  amount: number;
  description?: string;
}

/** One display-ready leg (account resolved to a label). */
export interface SabcrmJournalLegDetail {
  accountId: string;
  /** Resolved account name, or null when the account no longer exists. */
  accountLabel: string | null;
  /** "code · accountType" secondary line when resolvable. */
  accountMeta: string | null;
  amount: number;
  description?: string;
}

/* ─── List page ───────────────────────────────────────────────── */

/** Filters the list page sends to the fetcher (kit page is 1-based). */
export interface SabcrmJournalEntryListFilters {
  page?: number;
  limit?: number;
  q?: string;
  /** '' = all statuses (mapped to the crate's `all`). */
  status?: CrmVoucherEntryStatus | '';
  /** Voucher-book filter (the kit's party slot is repurposed for it). */
  voucherBookId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the entry date (in-page). */
  from?: string;
  to?: string;
}

/** A display-ready list row (book already resolved to a label). */
export interface SabcrmJournalEntryListRow {
  id: string;
  voucherNumber: string;
  bookId: string;
  /** Resolved book name, or null when the book no longer exists. */
  bookLabel: string | null;
  date: string;
  narration: string;
  reference: string;
  /** "2 dr / 1 cr" legs summary. */
  legsSummary: string;
  totalDebit: number;
  totalCredit: number;
  status: CrmVoucherEntryStatus;
}

export interface SabcrmJournalEntryListPage {
  rows: SabcrmJournalEntryListRow[];
  page: number;
  hasMore: boolean;
}

/* ─── Detail (view dialog) ────────────────────────────────────── */

/** The view dialog's payload — both leg tables fully resolved. */
export interface SabcrmJournalEntryDetail {
  id: string;
  voucherNumber: string;
  bookId: string;
  bookLabel: string | null;
  date: string;
  narration: string;
  reference: string;
  status: CrmVoucherEntryStatus;
  totalDebit: number;
  totalCredit: number;
  debits: SabcrmJournalLegDetail[];
  credits: SabcrmJournalLegDetail[];
  createdAt?: string;
  updatedAt?: string;
}

/* ─── KPIs ────────────────────────────────────────────────────── */

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmJournalEntryKpis {
  /** Entries scanned. */
  count: number;
  /** Posted entries dated in the current month. */
  postedThisMonthCount: number;
  /** Σ totalDebit over posted entries dated in the current month. */
  debitVolumeThisMonth: number;
  draftCount: number;
  /** Distinct voucher books referenced by scanned entries. */
  booksInUse: number;
  /** Dominant currency is not stored on entries — strip formats INR. */
  sampled: boolean;
}

/* ─── Create / update (full form payloads) ────────────────────── */

export interface SabcrmJournalEntryFullInput {
  /**
   * Voucher book. Optional — when absent the action finds the
   * project's first `journal` book and seeds a default "Journal" book
   * if none exists yet (same behaviour as the legacy 2-line dialog).
   */
  voucherBookId?: string;
  voucherNumber: string;
  /** `YYYY-MM-DD`. */
  date: string;
  narration?: string;
  reference?: string;
  debitEntries: SabcrmJournalLegInput[];
  creditEntries: SabcrmJournalLegInput[];
  /** Save draft vs save & post (defaults to draft). */
  status?: 'draft' | 'posted';
}

/**
 * Full-form patch (draft entries only — posted entries are immutable).
 * Legs must always be patched together so the balance check can run.
 */
export type SabcrmJournalEntryFullPatch = Partial<
  Omit<SabcrmJournalEntryFullInput, 'status'>
>;
