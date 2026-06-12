/**
 * SabCRM Finance — payment-receipt surface action types.
 *
 * Shared between `sabcrm-finance-payment-receipts.actions.ts` ('use
 * server' modules may only export async functions) and the
 * `/sabcrm/finance/payment-receipts` doc-surface clients. Mirrors the
 * `sabcrm-finance-invoices.actions.types.ts` convention (finance-rollout
 * spec §3.7).
 */

import type {
  CrmPaymentMode,
  CrmReceiptStatus,
} from '@/lib/rust-client/crm-payment-receipts';
import type {
  SabcrmDocAttachmentInput,
  SabcrmPartyObjectSlug,
} from './sabcrm-finance-invoices.actions.types';

/* ─── Allocations (receipt → invoices) ────────────────────────── */

/** One `applyTo` row — money applied to a specific invoice. */
export interface SabcrmReceiptAllocationInput {
  invoiceId: string;
  amount: number;
}

/** A display-ready allocation (invoice resolved to its number). */
export interface SabcrmReceiptAllocationRef {
  invoiceId: string;
  /** Resolved invoice number, or null when the invoice is gone. */
  invoiceNo: string | null;
  amount: number;
  /** Invoice detail route when the invoice still resolves. */
  href: string | null;
  status?: string;
}

/* ─── Create / update (full form payloads) ────────────────────── */

/**
 * The full receipt-form payload. NB Rust wire quirks (spec §3.7):
 * `CreatePaymentReceiptInput` does not accept `exchangeRate` or
 * `attachments` — the action follows up with a PATCH when either is
 * set (the update DTO accepts both).
 */
export interface SabcrmReceiptFullInput {
  receiptNo: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** REAL picked party (records-engine record id). Required. */
  clientId: string;
  mode: CrmPaymentMode;
  /** REAL picked payment account (`crm_payment_accounts`). Required. */
  bankAccountId: string;
  /** Amount received. Required, finite, > 0. */
  amount: number;
  currency: string;
  exchangeRate?: number;
  /** Mode-specific details. */
  chequeNo?: string;
  /** `YYYY-MM-DD`. */
  chequeDate?: string;
  txnId?: string;
  reference?: string;
  /** Allocation table (each row a REAL picked open invoice). */
  applyTo?: SabcrmReceiptAllocationInput[];
  /** Park any unallocated remainder as a customer advance. */
  excessAsAdvance?: boolean;
  tdsDeducted?: number;
  bankCharges?: number;
  notes?: string;
  attachments?: SabcrmDocAttachmentInput[];
  /** Optional lineage parent (whitelisted by the crate). */
  fromKind?: 'invoice' | 'proforma';
  fromId?: string;
}

/**
 * Edit-mode patch. Per the finance-rollout spec (§3.7 / G4) the edit
 * form LOCKS the financial identity fields — `amount`, `mode`,
 * `applyTo`, `clientId`, `currency` are not patchable from this surface
 * (changing them would require re-running the invoice `amountPaid`
 * reconciliation; the Rust DTO now accepts them, unlocking is a
 * follow-up).
 */
export interface SabcrmReceiptFullPatch {
  receiptNo?: string;
  /** `YYYY-MM-DD`. */
  date?: string;
  bankAccountId?: string;
  chequeNo?: string;
  /** `YYYY-MM-DD`. */
  chequeDate?: string;
  txnId?: string;
  reference?: string;
  exchangeRate?: number;
  tdsDeducted?: number;
  bankCharges?: number;
  notes?: string;
  attachments?: SabcrmDocAttachmentInput[];
}

/* ─── Status workflow ─────────────────────────────────────────── */

/** Allowed manual transitions per current status. */
export const SABCRM_RECEIPT_TRANSITIONS: Record<
  CrmReceiptStatus,
  CrmReceiptStatus[]
> = {
  received: ['cleared', 'bounced'],
  cleared: [],
  bounced: ['received'],
};

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmReceiptListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmReceiptStatus | '';
  clientId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the receipt date. */
  from?: string;
  to?: string;
}

/** A display-ready list row (party + account resolved to labels). */
export interface SabcrmReceiptListRow {
  id: string;
  receiptNo: string;
  partyId: string;
  /** Resolved customer label, or null when the record no longer exists. */
  partyLabel: string | null;
  partyObjectSlug: SabcrmPartyObjectSlug | null;
  date: string;
  mode: CrmPaymentMode;
  bankAccountId: string;
  /** Resolved payment-account name, or null when it no longer exists. */
  bankAccountLabel: string | null;
  amount: number;
  currency: string;
  tdsDeducted: number;
  bankCharges: number;
  /** Invoices this receipt is applied to. */
  allocationCount: number;
  status: CrmReceiptStatus;
}

export interface SabcrmReceiptListPage {
  rows: SabcrmReceiptListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmReceiptKpis {
  /** Dominant currency among scanned receipts (formats the strip). */
  currency: string;
  /** Σ amount for non-bounced receipts dated in the current month. */
  collectedThisMonth: number;
  collectedThisMonthCount: number;
  /** Σ amount over `received` (not yet cleared) receipts. */
  unclearedTotal: number;
  unclearedCount: number;
  bouncedCount: number;
  /** Σ tdsDeducted since the current Indian FY start (Apr 1). */
  tdsFyToDate: number;
  /** Receipts scanned. */
  count: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/** Detail payload — lineage rail + allocation card, pre-resolved. */
export interface SabcrmReceiptRelated {
  /** Lineage parents (invoice / proforma), resolved to doc numbers. */
  related: import('./sabcrm-finance-invoices.actions.types').SabcrmRelatedDocRef[];
  /** `applyTo` rows resolved to invoice numbers + detail links. */
  allocations: SabcrmReceiptAllocationRef[];
}
