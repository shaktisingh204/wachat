import 'server-only';

/**
 * CRM POS client — wraps `/v1/crm/pos`.
 *
 * Mirrors the four POS collections defined in
 * `rust/crates/crm-pos/src/types.rs`:
 *   - sessions, transactions, holds, refunds.
 *
 * The TS server actions in `src/app/actions/crm-pos.actions.ts` go
 * Mongo-direct today; this client exists so the swap to the Rust BFF
 * is a one-line flag flip (mirrors the `useRustCrm()` pattern used by
 * `crm-invoices.actions.ts` / `crm-coupons.actions.ts`).
 */
import { rustFetch } from './fetcher';

/* ─── Shared sub-types ───────────────────────────────────────────────── */

export interface CrmPosLineItem {
  itemId?: string | null;
  name: string;
  quantity: number;
  rate: number;
  taxRate?: number;
  total: number;
}

export type CrmPosPaymentSplitMethod = 'cash' | 'card' | 'upi' | 'wallet';

export interface CrmPosPaymentSplit {
  method: CrmPosPaymentSplitMethod;
  amount: number;
}

export interface CrmPosRefundedLineItem {
  originalLineItemIndex: number;
  quantity: number;
  refundAmount: number;
}

/* ─── Sessions ───────────────────────────────────────────────────────── */

export type CrmPosSessionStatus =
  | 'open'
  | 'closed'
  | 'reconciled'
  | 'archived';

export interface CrmPosSessionDoc {
  _id: string;
  userId?: string;
  terminalId: string;
  openedBy: string;
  openedAt: string;
  openingCash: number;
  closedAt?: string | null;
  closingCash?: number | null;
  expectedCash?: number | null;
  discrepancy?: number | null;
  status: CrmPosSessionStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CrmPosSessionListParams {
  page?: number;
  limit?: number;
  terminalId?: string;
  status?: CrmPosSessionStatus | 'all';
}

export interface CrmPosSessionListResponse {
  items: CrmPosSessionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmPosSessionOpenInput {
  terminalId: string;
  openingCash: number;
  notes?: string;
}

export interface CrmPosSessionCloseInput {
  closingCash: number;
  notes?: string;
}

/* ─── Transactions ───────────────────────────────────────────────────── */

export type CrmPosTransactionStatus = 'completed' | 'voided' | 'refunded';
export type CrmPosPaymentMethod =
  | 'cash'
  | 'card'
  | 'upi'
  | 'wallet'
  | 'split';

export interface CrmPosTransactionDoc {
  _id: string;
  userId?: string;
  sessionId: string;
  transactionNumber: string;
  customerId?: string | null;
  lineItems: CrmPosLineItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: CrmPosPaymentMethod;
  paymentSplits?: CrmPosPaymentSplit[] | null;
  status: CrmPosTransactionStatus;
  cashierId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CrmPosTransactionListParams {
  page?: number;
  limit?: number;
  sessionId?: string;
  status?: CrmPosTransactionStatus | 'all';
}

export interface CrmPosTransactionListResponse {
  items: CrmPosTransactionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmPosTransactionCreateInput {
  sessionId: string;
  customerId?: string;
  lineItems: CrmPosLineItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: CrmPosPaymentMethod;
  paymentSplits?: CrmPosPaymentSplit[];
}

export interface CrmPosTransactionRefundInput {
  reason: string;
  refundedLineItems: CrmPosRefundedLineItem[];
  refundTotal: number;
  refundMethod: CrmPosPaymentSplitMethod;
}

/* ─── Holds ──────────────────────────────────────────────────────────── */

export type CrmPosHoldStatus = 'held' | 'recalled' | 'voided' | 'archived';

export interface CrmPosHoldDoc {
  _id: string;
  userId?: string;
  sessionId: string;
  customerId?: string | null;
  lineItems: CrmPosLineItem[];
  holdReason?: string | null;
  heldBy: string;
  heldAt: string;
  recalledAt?: string | null;
  recalledTransactionId?: string | null;
  status: CrmPosHoldStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CrmPosHoldListParams {
  page?: number;
  limit?: number;
  sessionId?: string;
  status?: CrmPosHoldStatus | 'all';
}

export interface CrmPosHoldListResponse {
  items: CrmPosHoldDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmPosHoldCreateInput {
  sessionId: string;
  customerId?: string;
  lineItems: CrmPosLineItem[];
  holdReason?: string;
}

export interface CrmPosHoldRecallInput {
  paymentMethod: CrmPosPaymentMethod;
  paymentSplits?: CrmPosPaymentSplit[];
}

/* ─── Refunds ────────────────────────────────────────────────────────── */

export type CrmPosRefundStatus =
  | 'pending'
  | 'completed'
  | 'voided'
  | 'archived';

export interface CrmPosRefundDoc {
  _id: string;
  userId?: string;
  originalTransactionId: string;
  reason: string;
  refundedLineItems: CrmPosRefundedLineItem[];
  refundTotal: number;
  refundMethod: CrmPosPaymentSplitMethod;
  processedBy: string;
  processedAt: string;
  status: CrmPosRefundStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CrmPosRefundListParams {
  page?: number;
  limit?: number;
  status?: CrmPosRefundStatus | 'all';
}

export interface CrmPosRefundListResponse {
  items: CrmPosRefundDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

/* ─── Query builders ─────────────────────────────────────────────────── */

function qs(params: Record<string, unknown> | undefined): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/* ─── Public API surface ─────────────────────────────────────────────── */

export const crmPosApi = {
  sessions: {
    list: (params?: CrmPosSessionListParams) =>
      rustFetch<CrmPosSessionListResponse>(
        `/v1/crm/pos/sessions${qs(params as Record<string, unknown>)}`,
      ),
    getById: (id: string) =>
      rustFetch<CrmPosSessionDoc>(
        `/v1/crm/pos/sessions/${encodeURIComponent(id)}`,
      ),
    open: (input: CrmPosSessionOpenInput) =>
      rustFetch<{ id: string; entity: CrmPosSessionDoc }>(
        '/v1/crm/pos/sessions',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    close: (id: string, input: CrmPosSessionCloseInput) =>
      rustFetch<CrmPosSessionDoc>(
        `/v1/crm/pos/sessions/${encodeURIComponent(id)}/close`,
        { method: 'POST', body: JSON.stringify(input) },
      ),
    reconcile: (id: string) =>
      rustFetch<CrmPosSessionDoc>(
        `/v1/crm/pos/sessions/${encodeURIComponent(id)}/reconcile`,
        { method: 'POST' },
      ),
    archive: (id: string) =>
      rustFetch<{ deleted: boolean }>(
        `/v1/crm/pos/sessions/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      ),
  },
  transactions: {
    list: (params?: CrmPosTransactionListParams) =>
      rustFetch<CrmPosTransactionListResponse>(
        `/v1/crm/pos/transactions${qs(params as Record<string, unknown>)}`,
      ),
    getById: (id: string) =>
      rustFetch<CrmPosTransactionDoc>(
        `/v1/crm/pos/transactions/${encodeURIComponent(id)}`,
      ),
    create: (input: CrmPosTransactionCreateInput) =>
      rustFetch<{ id: string; entity: CrmPosTransactionDoc }>(
        '/v1/crm/pos/transactions',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    void: (id: string, reason?: string) =>
      rustFetch<CrmPosTransactionDoc>(
        `/v1/crm/pos/transactions/${encodeURIComponent(id)}/void`,
        { method: 'POST', body: JSON.stringify({ reason }) },
      ),
    refund: (id: string, input: CrmPosTransactionRefundInput) =>
      rustFetch<{ id: string; entity: CrmPosRefundDoc }>(
        `/v1/crm/pos/transactions/${encodeURIComponent(id)}/refund`,
        { method: 'POST', body: JSON.stringify(input) },
      ),
  },
  holds: {
    list: (params?: CrmPosHoldListParams) =>
      rustFetch<CrmPosHoldListResponse>(
        `/v1/crm/pos/holds${qs(params as Record<string, unknown>)}`,
      ),
    create: (input: CrmPosHoldCreateInput) =>
      rustFetch<{ id: string; entity: CrmPosHoldDoc }>(
        '/v1/crm/pos/holds',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    recall: (id: string, input: CrmPosHoldRecallInput) =>
      rustFetch<{ id: string; entity: CrmPosTransactionDoc }>(
        `/v1/crm/pos/holds/${encodeURIComponent(id)}/recall`,
        { method: 'POST', body: JSON.stringify(input) },
      ),
  },
  refunds: {
    list: (params?: CrmPosRefundListParams) =>
      rustFetch<CrmPosRefundListResponse>(
        `/v1/crm/pos/refunds${qs(params as Record<string, unknown>)}`,
      ),
    getById: (id: string) =>
      rustFetch<CrmPosRefundDoc>(
        `/v1/crm/pos/refunds/${encodeURIComponent(id)}`,
      ),
  },
};
