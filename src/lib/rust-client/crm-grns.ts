import 'server-only';

/**
 * CRM GRN (Goods Receipt Note) client — wraps `/v1/crm/grns`.
 *
 * Counterpart of the Rust crate `crm-grns`. The Rust handlers return
 * the full `Grn` document on every endpoint; this module narrows the
 * shape into a TS-friendly `CrmGrnDoc` for the UI layer.
 *
 * A GRN records goods physically received from a vendor against a
 * Purchase Order (the operational counterpart to a bill). The PO link
 * (`poId`) is optional — direct receipts with no parent PO are allowed
 * for unplanned vendor deliveries.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_extras_types::Grn ──────────────────── */

/**
 * One received-line row on a GRN. Mirrors `GrnLineItem` in the Rust
 * types crate. `receivedQty == acceptedQty + rejectedQty` is enforced
 * at the server-action layer, not at the type level. `serialNos` is
 * populated only for serialized SKUs; `batch` + `expiry` only for
 * batch-tracked SKUs.
 */
export interface CrmGrnLineItem {
  itemId: string;
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  batch?: string;
  expiry?: string;
  serialNos?: string[];
}

/** File attachment — mirrors `crm_core::Attachment`. */
export interface CrmGrnAttachment {
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

/**
 * Lower-case status strings accepted by the Rust handler. Mirrors the
 * serde `lowercase` representation of `crm_extras_types::GrnStatus`.
 */
export type CrmGrnStatus = 'draft' | 'inspected' | 'posted' | 'rejected';

export interface CrmGrnDoc {
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

  /* doc number + dates */
  grnNo: string;
  date: string;

  /* references */
  poId?: string;
  vendorId: string;
  warehouseId: string;

  /* received lines */
  items: CrmGrnLineItem[];

  /* inspection */
  inspectorId?: string;
  attachments?: CrmGrnAttachment[];

  /* workflow + counterparts */
  status?: CrmGrnStatus | string;
  ginId?: string;
  mrnId?: string;
  lineage?: Array<{ kind: string; id: string }>;

  /* mirrored top-level dates for convenience */
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmGrnListParams {
  page?: number;
  limit?: number;
  q?: string;
  poId?: string;
  vendorId?: string;
  status?: CrmGrnStatus | string;
}

/**
 * Input shape for `POST /v1/crm/grns`. Required: `grnNo`, `date`,
 * `vendorId`, `warehouseId`, `items[]`. Optional: `poId` (omit for
 * direct receipts), `inspectorId`, `attachments[]`.
 *
 * `ginId` / `mrnId` are NOT exposed here — those forward links are
 * populated server-side by the GIN-out / MRN-out flows. `lineage[]` is
 * seeded by the handler when `poId` is supplied.
 */
export interface CrmGrnCreateInput {
  grnNo: string;
  date: string;
  poId?: string;
  vendorId: string;
  warehouseId: string;
  items: CrmGrnLineItem[];
  inspectorId?: string;
  attachments?: CrmGrnAttachment[];
  projectId?: string;
}

/**
 * Input shape for `PATCH /v1/crm/grns/:grnId`. `grnNo`, `poId`, `ginId`,
 * `mrnId`, and `lineage` are intentionally NOT updatable — see the Rust
 * DTO doc comment.
 */
export type CrmGrnUpdateInput = Partial<
  Omit<CrmGrnCreateInput, 'grnNo' | 'poId' | 'projectId'>
> & {
  status?: CrmGrnStatus | string;
};

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmGrnListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.poId) qs.set('poId', p.poId);
  if (p.vendorId) qs.set('vendorId', p.vendorId);
  if (p.status) qs.set('status', String(p.status));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmGrnsApi = {
  list: (params?: CrmGrnListParams) =>
    rustFetch<CrmGrnDoc[]>(`/v1/crm/grns${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmGrnDoc>(`/v1/crm/grns/${encodeURIComponent(id)}`),
  create: (input: CrmGrnCreateInput) =>
    rustFetch<CrmGrnDoc>('/v1/crm/grns', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmGrnUpdateInput) =>
    rustFetch<CrmGrnDoc>(`/v1/crm/grns/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/grns/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
