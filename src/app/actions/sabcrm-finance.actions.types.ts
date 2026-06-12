/**
 * SabCRM Finance — action input/output types.
 *
 * Lives beside `sabcrm-finance.actions.ts` because `'use server'` modules
 * may only export async functions; shared types go here (mirrors the
 * `sabcrm-views.actions.types.ts` convention).
 */

import type { CrmInvoiceStatus } from '@/lib/rust-client/crm-invoices';

/**
 * The "New invoice" dialog payload — a deliberately small, form-shaped
 * subset. The action expands it into the full Rust `CreateInvoiceInput`
 * (single line item, totals derived from `amount`).
 */
export interface SabcrmInvoiceFormInput {
  /** Document number, e.g. `INV-2026-0001`. Required. */
  invoiceNo: string;
  /** Invoice total. Required, finite, ≥ 0. */
  amount: number;
  /** ISO-4217 code (e.g. `INR`, `USD`). Required. */
  currency: string;
  /** Invoice date (ISO string, e.g. `2026-06-11`). Required. */
  date: string;
  /** Due date (ISO string). Defaults to `date` when omitted. */
  dueDate?: string;
  /** Workflow status. Defaults to `draft`. */
  status?: CrmInvoiceStatus;
  /**
   * Optional buyer account id (24-char hex). The proving-vertical dialog
   * has no customer picker yet, so the action mints a placeholder id
   * when absent (the Rust DTO requires one).
   */
  clientId?: string;
}

/** Partial update accepted by `updateSabcrmInvoice`. */
export interface SabcrmInvoicePatchInput {
  invoiceNo?: string;
  currency?: string;
  date?: string;
  dueDate?: string;
  status?: CrmInvoiceStatus;
  /** New total — re-derives the single-line-item `items`/`totals` pair. */
  amount?: number;
}

/* ═══════════════════════════════════════════════════════════════════
 * Finance tranche 1 — shared dialog payloads for the remaining
 * document crates (quotations, sales orders, credit/debit notes,
 * payment receipts, bills, proforma invoices) plus payment accounts.
 * Each action expands these small form shapes into the entity's full
 * Rust create DTO (single line item + totals derived from `amount`,
 * placeholder party ids minted when the dialog has no picker yet).
 * ═══════════════════════════════════════════════════════════════════ */

/**
 * The generic "New document" dialog payload used by every finance
 * document entity (everything except payment accounts).
 */
export interface SabcrmFinanceDocFormInput {
  /** Document number, e.g. `QT-2026-0001`. Required. */
  number: string;
  /** Document total. Required, finite, ≥ 0. */
  amount: number;
  /** ISO-4217 code (e.g. `INR`, `USD`). Required. */
  currency: string;
  /** Document date (ISO string, e.g. `2026-06-12`). Required. */
  date: string;
  /** Workflow status (entity-specific vocabulary). Optional. */
  status?: string;
  /**
   * Optional counterparty id (24-char hex; client or vendor depending
   * on the entity). A placeholder ObjectId is minted when absent.
   */
  partyId?: string;
}

/**
 * Status-only patch — the tranche-1 update actions exist for workflow
 * transitions; richer field edits stay on the detail surfaces.
 */
export interface SabcrmFinanceDocPatchInput {
  status?: string;
}

/** The "New payment account" dialog payload. */
export interface SabcrmPaymentAccountFormInput {
  /** Display name, e.g. `HDFC Current`. Required. */
  accountName: string;
  /** `bank` | `cash` | `upi` | `wallet` | `employee`. Required. */
  accountType: string;
  /** Opening balance. Defaults to `0`. */
  openingBalance?: number;
  /** ISO-4217 code. Defaults to `INR` server-side. */
  currency?: string;
}

/** Patch accepted by `updateSabcrmPaymentAccount`. */
export interface SabcrmPaymentAccountPatchInput {
  accountName?: string;
  accountType?: string;
  status?: string;
  openingBalance?: number;
  currency?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 * Finance tranche 2 — dialog payloads for the banking/ledger entities.
 * Expenses + payouts reuse {@link SabcrmFinanceDocFormInput}; the five
 * shapes below cover the entities whose columns don't fit the generic
 * number/party/date/amount mould.
 * ═══════════════════════════════════════════════════════════════════ */

/** The "New bank transaction" dialog payload. */
export interface SabcrmBankTransactionFormInput {
  /** Transaction date (ISO string, e.g. `2026-06-12`). Required. */
  date: string;
  /** Stored positive; sign is conveyed by `type`. Required. */
  amount: number;
  /** `debit` | `credit`. Required. */
  type: string;
  description?: string;
  referenceNumber?: string;
  /**
   * Optional source account id (24-char hex into payment accounts). A
   * placeholder ObjectId is minted when absent (no picker yet).
   */
  accountId?: string;
}

/** The "New recurring invoice" dialog payload. */
export interface SabcrmRecurringInvoiceFormInput {
  title?: string;
  /** `daily` | `weekly` | `monthly` | `quarterly` | `yearly`. */
  frequency?: string;
  /** Schedule start (ISO string). Required — also seeds `nextRunAt`. */
  startDate: string;
  /** Optional customer id (24-char hex); placeholder minted when absent. */
  customerId?: string;
}

/** The "New voucher book" dialog payload (numbering series). */
export interface SabcrmVoucherBookFormInput {
  /** Display name, e.g. `Journal 2026`. Required. */
  name: string;
  /** `payment` | `receipt` | `contra` | `journal` | `purchase` | `sales`. */
  type: string;
  prefix?: string;
  startingNumber?: number;
}

/** The "New petty cash float" dialog payload. */
export interface SabcrmPettyCashFormInput {
  branchName?: string;
  custodianName?: string;
  /** Required, finite, ≥ 0. */
  openingBalance: number;
  currency?: string;
}

/** The "New budget" dialog payload. */
export interface SabcrmBudgetFormInput {
  /** Cost head, e.g. `Marketing`. Required. */
  budgetHead: string;
  /** Period label, e.g. `FY 2026-27` or `2026-06`. Required. */
  period: string;
  department?: string;
  /** Required, finite, ≥ 0. */
  plannedAmount: number;
  currency?: string;
}

/** The "New reconciliation run" dialog payload. */
export interface SabcrmReconciliationFormInput {
  /** Window start (ISO date). Required. */
  periodStart: string;
  /** Window end (ISO date). Required. */
  periodEnd: string;
  openingBalance?: number;
  closingBalance?: number;
  /**
   * Optional ledger account id (24-char hex); a placeholder ObjectId is
   * minted when absent (no account picker yet).
   */
  accountId?: string;
  notes?: string;
}
