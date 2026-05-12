import 'server-only';

/**
 * CRM Purchase Order client — wraps `/v1/crm/purchase-orders`.
 *
 * Counterpart of the Rust crate `crm-purchase-orders`. The Rust
 * handlers return the full `PurchaseOrder` document on every endpoint;
 * this module narrows the shape into a TS-friendly
 * `CrmPurchaseOrderDoc` for the UI layer.
 *
 * Purchase Orders are the buy-side mirror of Sales Orders. They have
 * a **vendor** (NOT a client/customer), line items, totals, and a
 * lifecycle status — `draft → awaiting_approval → approved → sent →
 * partial/received → closed | cancelled`.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm-purchases-types::PurchaseOrder ────── */

/**
 * Single line item on a purchase order. Mirrors
 * `crm_sales_types::LineItem` — the same struct is reused on the
 * buy-side, so most fulfillment fields stay `undefined` until a GRN
 * lands.
 */
export interface CrmPurchaseOrderLineItem {
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
  /** Receiving warehouse — populated when GRN reconciliation begins. */
  warehouseId?: string;
  qtyPending?: number;
  qtyDelivered?: number;
  qtyInvoiced?: number;
}

/** Document-level totals. Mirrors `crm_sales_types::Totals`. */
export interface CrmPurchaseOrderTotals {
  subTotal: number;
  discountOverall?: number;
  shippingCharge?: number;
  adjustment?: number;
  roundOff?: number;
  total: number;
}

/** Approval workflow sub-document — populated post-approval flow. */
export interface CrmPurchaseOrderApproval {
  requestedBy?: string;
  requestedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  note?: string;
}

/**
 * Lower-case status strings accepted by the Rust handler. Mirrors
 * the snake_case `serde` representation of
 * `crm_purchases_types::PurchaseOrderStatus`.
 */
export type CrmPurchaseOrderStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'approved'
  | 'sent'
  | 'partial'
  | 'received'
  | 'closed'
  | 'cancelled';

export interface CrmPurchaseOrderDoc {
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

  /* doc number + dates */
  poNo: string;
  date: string;
  expectedDelivery?: string;

  /* parties + locations */
  vendorId: string;
  shipToWarehouseId?: string;
  billingBranchId?: string;
  paymentTerms?: string;

  /* money */
  currency: string;
  exchangeRate?: number;

  /* line items + totals */
  items: CrmPurchaseOrderLineItem[];
  totals: CrmPurchaseOrderTotals;

  /* body */
  termsAndConditions?: string;
  notes?: string;

  /* workflow */
  approval?: CrmPurchaseOrderApproval;
  status?: CrmPurchaseOrderStatus | string;

  /* downstream links */
  linkedGrnIds?: string[];
  linkedBillIds?: string[];
  lineage?: Array<{ kind: string; id: string }>;

  /* mirrored top-level dates for convenience */
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmPurchaseOrderListParams {
  page?: number;
  limit?: number;
  q?: string;
  vendorId?: string;
  status?: CrmPurchaseOrderStatus | string;
}

/**
 * Input shape for `POST /v1/crm/purchase-orders`. Required fields:
 * `poNo`, `date`, `vendorId`, `currency`, `items`, `totals` — see the
 * Rust DTO for the full contract.
 */
export interface CrmPurchaseOrderCreateInput {
  poNo: string;
  date: string;
  expectedDelivery?: string;
  vendorId: string;
  shipToWarehouseId?: string;
  billingBranchId?: string;
  paymentTerms?: string;
  currency: string;
  items: CrmPurchaseOrderLineItem[];
  totals: CrmPurchaseOrderTotals;
  termsAndConditions?: string;
  notes?: string;
  projectId?: string;
  fromKind?: string;
  fromId?: string;
}

/**
 * Input shape for `PATCH /v1/crm/purchase-orders/:poId`. `poNo`,
 * `approval`, and lineage fields are intentionally NOT updatable here
 * — see the Rust DTO doc comment.
 */
export type CrmPurchaseOrderUpdateInput = Partial<
  Omit<CrmPurchaseOrderCreateInput, 'poNo' | 'projectId' | 'fromKind' | 'fromId'>
> & {
  status?: CrmPurchaseOrderStatus | string;
};

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmPurchaseOrderListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.vendorId) qs.set('vendorId', p.vendorId);
  if (p.status) qs.set('status', String(p.status));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmPurchaseOrdersApi = {
  list: (params?: CrmPurchaseOrderListParams) =>
    rustFetch<CrmPurchaseOrderDoc[]>(
      `/v1/crm/purchase-orders${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmPurchaseOrderDoc>(
      `/v1/crm/purchase-orders/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmPurchaseOrderCreateInput) =>
    rustFetch<CrmPurchaseOrderDoc>('/v1/crm/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmPurchaseOrderUpdateInput) =>
    rustFetch<CrmPurchaseOrderDoc>(
      `/v1/crm/purchase-orders/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/purchase-orders/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),
};
