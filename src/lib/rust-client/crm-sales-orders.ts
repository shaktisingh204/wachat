import 'server-only';

/**
 * CRM Sales Order client — wraps `/v1/crm/sales-orders`.
 *
 * Counterpart of the Rust crate `crm-sales-orders`. The Rust handlers
 * return the full `SalesOrder` document on every endpoint; this module
 * narrows the shape into a TS-friendly `CrmSalesOrderDoc` and provides
 * camelCase access for the UI layer.
 *
 * Mirrors the field set of `crm_sales_types::SalesOrder` — header,
 * shared `LineItem`/`Totals`, status enum (open/partial/fulfilled/
 * closed/cancelled), and the server-managed link arrays.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_sales_types::SalesOrder ──────────── */

export type CrmSalesOrderStatus =
  | 'open'
  | 'partial'
  | 'fulfilled'
  | 'closed'
  | 'cancelled';

export type CrmSalesOrderDeliveryMethod =
  | 'courier'
  | 'transporter'
  | 'in_house'
  | 'pickup'
  | 'digital';

export interface CrmSalesOrderLineItem {
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
  /* SO-only fulfillment quartet. */
  warehouseId?: string;
  qtyPending?: number;
  qtyDelivered?: number;
  qtyInvoiced?: number;
}

export interface CrmSalesOrderTotals {
  subTotal: number;
  discountOverall?: number;
  shippingCharge?: number;
  adjustment?: number;
  roundOff?: number;
  total: number;
}

/** Mirrors `crm_sales_types::Address` (all fields optional). */
export interface CrmSalesOrderAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  label?: string;
}

export interface CrmSalesOrderDoc {
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
  soNo: string;
  date: string;
  clientId: string;
  quotationRef?: string;
  poNo?: string;
  poDate?: string;
  expectedShipmentDate?: string;
  deliveryMethod?: CrmSalesOrderDeliveryMethod;
  paymentTerms?: string;
  shippingAddress?: CrmSalesOrderAddress;
  currency: string;
  exchangeRate?: number;
  items: CrmSalesOrderLineItem[];
  totals: CrmSalesOrderTotals;
  customerNotes?: string;
  internalNotes?: string;
  /** SabFiles pointers (model-only today — the write DTOs don't accept
   *  them yet; rendered read-only on the detail rail). */
  attachments?: {
    fileId: string;
    name?: string;
    mimeType?: string;
    size?: number;
  }[];
  status: CrmSalesOrderStatus;
  linkedDeliveryIds?: string[];
  linkedInvoiceIds?: string[];
  designMetadata?: Record<string, unknown>;
  lineage?: Array<{ kind: string; id: string }>;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmSalesOrderListParams {
  page?: number;
  limit?: number;
  q?: string;
  clientId?: string;
  status?: CrmSalesOrderStatus | string;
}

export interface CrmSalesOrderCreateInput {
  projectId?: string;
  soNo: string;
  date: string;
  clientId: string;
  quotationRef?: string;
  poNo?: string;
  poDate?: string;
  expectedShipmentDate?: string;
  deliveryMethod?: CrmSalesOrderDeliveryMethod;
  paymentTerms?: string;
  /** Accepted by the Rust DTO since the finance-rollout G7 fix. */
  shippingAddress?: CrmSalesOrderAddress;
  currency: string;
  exchangeRate?: number;
  items: CrmSalesOrderLineItem[];
  totals: CrmSalesOrderTotals;
  customerNotes?: string;
  internalNotes?: string;
  status?: CrmSalesOrderStatus;
  fromKind?: string;
  fromId?: string;
  designMetadata?: Record<string, unknown>;
}

export interface CrmSalesOrderUpdateInput {
  date?: string;
  quotationRef?: string;
  poNo?: string;
  poDate?: string;
  expectedShipmentDate?: string;
  deliveryMethod?: CrmSalesOrderDeliveryMethod;
  paymentTerms?: string;
  /** Accepted by the Rust DTO since the finance-rollout G7 fix. */
  shippingAddress?: CrmSalesOrderAddress;
  currency?: string;
  exchangeRate?: number;
  items?: CrmSalesOrderLineItem[];
  totals?: CrmSalesOrderTotals;
  customerNotes?: string;
  internalNotes?: string;
  status?: CrmSalesOrderStatus;
  designMetadata?: Record<string, unknown>;
}

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmSalesOrderListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.clientId) qs.set('clientId', p.clientId);
  if (p.status) qs.set('status', String(p.status));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmSalesOrdersApi = {
  list: (params?: CrmSalesOrderListParams) =>
    rustFetch<CrmSalesOrderDoc[]>(`/v1/crm/sales-orders${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmSalesOrderDoc>(`/v1/crm/sales-orders/${encodeURIComponent(id)}`),
  create: (input: CrmSalesOrderCreateInput) =>
    rustFetch<CrmSalesOrderDoc>('/v1/crm/sales-orders', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmSalesOrderUpdateInput) =>
    rustFetch<CrmSalesOrderDoc>(`/v1/crm/sales-orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/sales-orders/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
