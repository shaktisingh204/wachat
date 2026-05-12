import 'server-only';

/**
 * CRM Debit Note client — wraps `/v1/crm/debit-notes`.
 *
 * Counterpart of the Rust crate `crm-debit-notes`. A debit note is the
 * buy-side mirror of a credit note — it adjusts a vendor bill downward
 * (you owe the vendor less, typically due to returns or short-shipment).
 *
 * The Rust handlers return the full `DebitNote` document on every
 * endpoint; this module narrows the shape into a TS-friendly
 * `CrmDebitNoteDoc` and provides camelCase access for the UI layer.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_purchases_types::DebitNote ──────── */

export type DebitNoteReason =
  | 'return'
  | 'discount'
  | 'price_adjust'
  | 'cancel'
  | 'other';

export type DebitNoteStatus = 'draft' | 'issued' | 'refunded' | 'cancelled';

/** Mirrors `crm_purchases_types::debit_note::RefundMode`. Semantics flip
 *  on the vendor side — `"credit"` means a balance held against the
 *  vendor (not the customer). */
export type DebitNoteRefundMode = 'cash' | 'credit' | 'replacement';

export interface CrmDebitNoteLineItem {
  itemId?: string;
  description?: string;
  hsnSac?: string;
  qty: number;
  unit?: string;
  rate: number;
  discountPct?: number;
  taxRatePct?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cessAmount?: number;
  total: number;
  warehouseId?: string;
  qtyPending?: number;
  qtyDelivered?: number;
  qtyInvoiced?: number;
}

export interface CrmDebitNoteTotals {
  subTotal: number;
  discountOverall?: number;
  shippingCharge?: number;
  adjustment?: number;
  roundOff?: number;
  total: number;
}

export interface CrmDebitNoteDoc {
  _id: string;
  identity?: {
    id?: string;
    projectId?: string;
    userId?: string;
    tenantId?: string;
  };
  audit?: {
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    updatedBy?: string;
  };
  assignment?: {
    assignedTo?: string;
    assignedBy?: string;
    assignedAt?: string;
  };
  dnNo: string;
  date: string;
  vendorId: string;
  linkedBillId?: string;
  reason: DebitNoteReason;
  currency: string;
  exchangeRate?: number;
  items: CrmDebitNoteLineItem[];
  totals: CrmDebitNoteTotals;
  refundMode: DebitNoteRefundMode;
  refundTxnId?: string;
  notes?: string;
  attachments?: unknown[];
  status?: DebitNoteStatus;
  lineage?: Array<{ kind: string; id: string }>;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmDebitNoteListParams {
  page?: number;
  limit?: number;
  q?: string;
  vendorId?: string;
  status?: DebitNoteStatus;
}

export interface CrmDebitNoteCreateInput {
  dnNo: string;
  date: string;
  vendorId: string;
  linkedBillId?: string;
  reason: DebitNoteReason;
  currency: string;
  items: CrmDebitNoteLineItem[];
  totals: CrmDebitNoteTotals;
  refundMode: DebitNoteRefundMode;
  refundTxnId?: string;
  notes?: string;
  fromKind?: string;
  fromId?: string;
}

export type CrmDebitNoteUpdateInput = Partial<
  Omit<CrmDebitNoteCreateInput, 'fromKind' | 'fromId'>
> & {
  status?: DebitNoteStatus;
};

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmDebitNoteListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.vendorId) qs.set('vendorId', p.vendorId);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmDebitNotesApi = {
  list: (params?: CrmDebitNoteListParams) =>
    rustFetch<CrmDebitNoteDoc[]>(`/v1/crm/debit-notes${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmDebitNoteDoc>(`/v1/crm/debit-notes/${encodeURIComponent(id)}`),
  create: (input: CrmDebitNoteCreateInput) =>
    rustFetch<CrmDebitNoteDoc>('/v1/crm/debit-notes', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmDebitNoteUpdateInput) =>
    rustFetch<CrmDebitNoteDoc>(`/v1/crm/debit-notes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/debit-notes/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
