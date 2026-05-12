import 'server-only';

/**
 * CRM Vendor Bid client — wraps `/v1/crm/vendor-bids`.
 *
 * Counterpart of the Rust crate `crm-vendor-bids`. The Rust handlers
 * return the full `VendorBid` document on every endpoint; this module
 * narrows the shape into a TS-friendly `CrmVendorBidDoc` for the UI
 * layer.
 *
 * A Vendor Bid is the response a vendor gives to an RFQ — it carries
 * pricing for the requested items (qty + unit price + lead time), plus
 * an overall total and workflow status (`submitted → shortlisted →
 * awarded | rejected | withdrawn`). Every bid has exactly one lineage
 * parent — the RFQ it was submitted against.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_extras_types::VendorBid ────────────── */

/**
 * Single line on a vendor bid. Mirrors `BidLineItem` from
 * `crm_extras_types::rfq` — `itemId` references the catalogue item the
 * vendor is quoting, `rate` is the vendor's unit price, and
 * `leadTimeDays` is the per-line promised lead time (vendors often
 * quote different leads per SKU).
 */
export interface CrmVendorBidLineItem {
  itemId?: string;
  qty: number;
  rate: number;
  leadTimeDays?: number;
  notes?: string;
}

/**
 * Document-level totals. Mirrors `Totals` from
 * `crm-sales-types::line_item`. Optional on the wire — vendors that
 * quote per-line only may submit `{}`.
 */
export interface CrmVendorBidTotals {
  subTotal?: number;
  discountOverall?: number;
  shippingCharge?: number;
  adjustment?: number;
  roundOff?: number;
  total?: number;
}

/**
 * Attachment ref on a vendor bid. Mirrors `crm_core::Attachment` — a
 * SabFiles `fileId` plus cached label/mime/size. Per the project's
 * "every file lives in SabFiles" policy, raw URLs are forbidden.
 */
export interface CrmVendorBidAttachment {
  fileId?: string;
  name?: string;
  mime?: string;
  size?: number;
  url?: string;
}

/**
 * Lower-case status strings accepted by the Rust handler. Mirrors the
 * `#[serde(rename_all = "lowercase")]` representation of
 * `crm_extras_types::BidStatus`.
 */
export type CrmVendorBidStatus =
  | 'submitted'
  | 'shortlisted'
  | 'awarded'
  | 'rejected'
  | 'withdrawn';

export interface CrmVendorBidDoc {
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

  /* references */
  rfqId: string;
  vendorId: string;

  /* priced response */
  items: CrmVendorBidLineItem[];
  totals?: CrmVendorBidTotals;
  currency: string;

  /* body */
  terms?: string;
  attachments?: CrmVendorBidAttachment[];

  /* denormalized cache for list views */
  vendorName?: string;

  /* workflow */
  status?: CrmVendorBidStatus | string;
  submittedAt?: string;

  /* lineage */
  lineage?: Array<{ kind: string; id: string }>;

  /* mirrored top-level dates for convenience */
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
}

export interface CrmVendorBidListParams {
  page?: number;
  limit?: number;
  q?: string;
  rfqId?: string;
  vendorId?: string;
  status?: CrmVendorBidStatus | string;
}

/**
 * Input shape for `POST /v1/crm/vendor-bids`. Required fields:
 * `rfqId`, `vendorId`, `currency`, and at least one `items[]` row —
 * see the Rust DTO for the full contract.
 */
export interface CrmVendorBidCreateInput {
  rfqId: string;
  vendorId: string;
  items: CrmVendorBidLineItem[];
  totals?: CrmVendorBidTotals;
  currency: string;
  terms?: string;
  attachments?: CrmVendorBidAttachment[];
  vendorName?: string;
  projectId?: string;
}

/**
 * Input shape for `PATCH /v1/crm/vendor-bids/:bidId`. `rfqId`,
 * `vendorId`, `lineage`, and `submittedAt` are intentionally NOT
 * updatable here — see the Rust DTO doc comment.
 */
export type CrmVendorBidUpdateInput = Partial<
  Omit<CrmVendorBidCreateInput, 'rfqId' | 'vendorId' | 'projectId'>
> & {
  status?: CrmVendorBidStatus | string;
};

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmVendorBidListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.rfqId) qs.set('rfqId', p.rfqId);
  if (p.vendorId) qs.set('vendorId', p.vendorId);
  if (p.status) qs.set('status', String(p.status));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmVendorBidsApi = {
  list: (params?: CrmVendorBidListParams) =>
    rustFetch<CrmVendorBidDoc[]>(`/v1/crm/vendor-bids${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmVendorBidDoc>(`/v1/crm/vendor-bids/${encodeURIComponent(id)}`),
  create: (input: CrmVendorBidCreateInput) =>
    rustFetch<CrmVendorBidDoc>('/v1/crm/vendor-bids', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmVendorBidUpdateInput) =>
    rustFetch<CrmVendorBidDoc>(`/v1/crm/vendor-bids/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/vendor-bids/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),
};
