import 'server-only';

/**
 * CRM Quotation client — wraps `/v1/crm/quotations`.
 *
 * Counterpart of the Rust crate `crm-quotations`. The Rust handlers
 * return the full `Quotation` document on every read/write endpoint;
 * this module narrows the shape into a TS-friendly `CrmQuotationDoc`
 * and provides camelCase access for the UI layer.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_sales_types::Quotation ──────────── */

/**
 * Single line item on a quotation. Mirrors `crm_sales_types::LineItem`
 * — all money fields are `number` to match the f64 wire format. The
 * fulfillment fields (`warehouseId`, `qty*`) are populated by the
 * downstream Sales Order flow and are typed optional here so the same
 * shape round-trips through the quotation → SO → invoice chain.
 */
export interface CrmQuotationLineItem {
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

/**
 * Document-level totals. Mirrors `crm_sales_types::Totals`.
 */
export interface CrmQuotationTotals {
  subTotal: number;
  discountOverall?: number;
  shippingCharge?: number;
  adjustment?: number;
  roundOff?: number;
  total: number;
}

export type CrmQuotationStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

export interface CrmQuotationDoc {
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
  attribution?: {
    source?: string;
    medium?: string;
    campaign?: string;
    referrerUrl?: string;
  };
  assignment?: {
    assignedTo?: string;
    assignedBy?: string;
    assignedAt?: string;
  };
  /* ----- doc identity ----- */
  quotationNo: string;
  date: string;
  validUntil: string;

  /* ----- parties ----- */
  clientId: string;
  referenceNo?: string;
  salesAgentId?: string;
  dealId?: string;
  subject?: string;

  /* ----- money ----- */
  currency: string;
  exchangeRate?: number;
  placeOfSupply?: string;

  /* ----- doc body ----- */
  items?: CrmQuotationLineItem[];
  totals?: CrmQuotationTotals;
  termsAndConditions?: string;
  customerNotes?: string;

  /* ----- workflow ----- */
  status?: CrmQuotationStatus;
  pdfStatus?: string;
  designMetadata?: Record<string, unknown>;

  /* ----- custom fields + audit ----- */
  customFields?: Record<string, unknown>;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmQuotationListParams {
  page?: number;
  limit?: number;
  q?: string;
  clientId?: string;
  status?: CrmQuotationStatus | string;
  fromKind?: 'lead' | 'deal' | string;
  fromId?: string;
}

export interface CrmQuotationCreateInput {
  projectId?: string;
  quotationNo: string;
  /** ISO-8601 timestamp. */
  date: string;
  /** ISO-8601 timestamp. */
  validUntil: string;
  clientId: string;
  currency: string;
  placeOfSupply?: string;
  subject?: string;
  termsAndConditions?: string;
  /** Persisted server-side as `customerNotes` — the Rust DTO accepts
   * `notes` and aliases it onto the canonical field. */
  notes?: string;
  items: CrmQuotationLineItem[];
  fromKind?: 'lead' | 'deal';
  fromId?: string;
  designMetadata?: Record<string, unknown>;
}

export interface CrmQuotationUpdateInput {
  quotationNo?: string;
  date?: string;
  validUntil?: string;
  clientId?: string;
  currency?: string;
  placeOfSupply?: string;
  subject?: string;
  termsAndConditions?: string;
  notes?: string;
  status?: CrmQuotationStatus | string;
  items?: CrmQuotationLineItem[];
  designMetadata?: Record<string, unknown>;
}

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmQuotationListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.clientId) qs.set('clientId', p.clientId);
  if (p.status) qs.set('status', String(p.status));
  if (p.fromKind) qs.set('fromKind', p.fromKind);
  if (p.fromId) qs.set('fromId', p.fromId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmQuotationsApi = {
  list: (params?: CrmQuotationListParams) =>
    rustFetch<CrmQuotationDoc[]>(`/v1/crm/quotations${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmQuotationDoc>(`/v1/crm/quotations/${encodeURIComponent(id)}`),
  create: (input: CrmQuotationCreateInput) =>
    rustFetch<CrmQuotationDoc>('/v1/crm/quotations', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmQuotationUpdateInput) =>
    rustFetch<CrmQuotationDoc>(`/v1/crm/quotations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/quotations/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
