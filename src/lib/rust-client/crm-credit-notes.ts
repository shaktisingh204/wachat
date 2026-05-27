import 'server-only';

/**
 * CRM Credit Note client — wraps `/v1/crm/credit-notes`.
 *
 * Counterpart of the Rust crate `crm-credit-notes`. The Rust handlers
 * return the full `CreditNote` document on every endpoint; this module
 * narrows the shape into a TS-friendly `CrmCreditNoteDoc` and provides
 * camelCase access for the UI layer.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_sales_types::CreditNote ─────────── */

export type CreditNoteReason =
  | 'return'
  | 'discount'
  | 'price_adjust'
  | 'cancel'
  | 'other';

export type CreditNoteStatus = 'draft' | 'issued' | 'refunded' | 'cancelled';

export type RefundMode = 'cash' | 'credit' | 'replacement';

export interface CreditNoteLineItem {
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

export interface CreditNoteTotals {
  subTotal: number;
  discountOverall?: number;
  shippingCharge?: number;
  adjustment?: number;
  roundOff?: number;
  total: number;
}

export interface CrmCreditNoteDoc {
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
  cnNo: string;
  date: string;
  clientId: string;
  linkedInvoiceId?: string;
  reason: CreditNoteReason;
  currency: string;
  exchangeRate?: number;
  items: CreditNoteLineItem[];
  totals: CreditNoteTotals;
  taxRecalc?: boolean;
  refundMode: RefundMode;
  refundTxnId?: string;
  autoApply?: boolean;
  notes?: string;
  attachments?: unknown[];
  status?: CreditNoteStatus;
  designMetadata?: Record<string, unknown>;
  lineage?: Array<{ kind: string; id: string }>;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmCreditNoteListParams {
  page?: number;
  limit?: number;
  q?: string;
  clientId?: string;
  status?: CreditNoteStatus | 'pending';
}

export interface CrmCreditNoteCreateInput {
  cnNo: string;
  date: string;
  clientId: string;
  linkedInvoiceId?: string;
  reason: CreditNoteReason;
  currency: string;
  items: CreditNoteLineItem[];
  totals: CreditNoteTotals;
  taxRecalc?: boolean;
  refundMode: RefundMode;
  refundTxnId?: string;
  autoApply?: boolean;
  notes?: string;
  fromKind?: string;
  fromId?: string;
  designMetadata?: Record<string, unknown>;
}

export type CrmCreditNoteUpdateInput = Partial<
  Omit<CrmCreditNoteCreateInput, 'fromKind' | 'fromId'>
> & {
  status?: CreditNoteStatus;
  designMetadata?: Record<string, unknown>;
};

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmCreditNoteListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.clientId) qs.set('clientId', p.clientId);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmCreditNotesApi = {
  list: (params?: CrmCreditNoteListParams) =>
    rustFetch<CrmCreditNoteDoc[]>(`/v1/crm/credit-notes${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmCreditNoteDoc>(`/v1/crm/credit-notes/${encodeURIComponent(id)}`),
  create: (input: CrmCreditNoteCreateInput) =>
    rustFetch<CrmCreditNoteDoc>('/v1/crm/credit-notes', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmCreditNoteUpdateInput) =>
    rustFetch<CrmCreditNoteDoc>(`/v1/crm/credit-notes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/credit-notes/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
