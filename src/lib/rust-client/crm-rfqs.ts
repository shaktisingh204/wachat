import 'server-only';

/**
 * CRM RFQ client — wraps `/v1/crm/rfqs`.
 *
 * Counterpart of the Rust crate `crm-rfqs`. The Rust handlers return the
 * canonical [`Rfq`] document (from `crm-extras-types::rfq`) on every
 * read/write endpoint; this module narrows the wire shape into a
 * TS-friendly `CrmRfqDoc` and provides camelCase access for the UI
 * layer.
 *
 * An RFQ (Request for Quotation) broadcasts a list of items to a set of
 * invited vendors and collects priced bids back. It's the precursor to
 * a Purchase Order — the `awarded` lifecycle state converts the chosen
 * bid into a PO. Lifecycle status: `draft → open → closed → awarded |
 * cancelled`.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_extras_types::rfq ──────────────── */

/**
 * Single requested-item row on an RFQ. Mirrors
 * `crm_extras_types::RfqLineItem` — RFQ lines carry **no price** by
 * design (price is collected via `VendorBid`); only the item, quantity,
 * and optional spec/description are captured here.
 */
export interface CrmRfqLineItem {
  /** Hex-encoded `crm_products._id` — required on the Rust side. */
  itemId: string;
  description?: string;
  qty: number;
  unit?: string;
  specs?: string;
}

/**
 * SabFile attachment pointer — mirrors `crm_core::Attachment`. RFQs
 * adhere to the project-wide "every file lives in SabFiles" policy, so
 * attachments are id-based references, never raw URLs.
 */
export interface CrmRfqAttachment {
  fileId?: string;
  name?: string;
  url?: string;
  mime?: string;
  size?: number;
}

/**
 * Lower-case status strings accepted by the Rust handler. Mirrors the
 * lowercase `serde` representation of
 * `crm_extras_types::RfqStatus`.
 */
export type CrmRfqStatus = 'draft' | 'open' | 'closed' | 'awarded' | 'cancelled';

export interface CrmRfqDoc {
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

  /* header */
  title: string;
  items: CrmRfqLineItem[];
  requiredBy?: string;

  /* invited parties (hex-encoded vendor ids) */
  vendorsInvited: string[];

  /* body */
  terms?: string;
  deadline?: string;

  /* workflow */
  status?: CrmRfqStatus | string;

  /* attachments */
  attachments?: CrmRfqAttachment[];

  /* lineage hooks */
  lineage?: Array<{ kind: string; id: string }>;

  /* mirrored top-level dates for convenience */
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmRfqListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmRfqStatus | string;
}

/**
 * Input shape for `POST /v1/crm/rfqs`. Required fields: `title`,
 * `items` (at least one). `vendorsInvited` is optional at create time —
 * vendors can be appended while the RFQ is still `open`. See the Rust
 * DTO for the full contract.
 */
export interface CrmRfqCreateInput {
  title: string;
  items: CrmRfqLineItem[];
  requiredBy?: string;
  vendorsInvited?: string[];
  terms?: string;
  deadline?: string;
  attachments?: CrmRfqAttachment[];
  projectId?: string;
  fromKind?: string;
  fromId?: string;
}

/**
 * Input shape for `PATCH /v1/crm/rfqs/:rfqId`. `lineage`, `audit`, and
 * project scope are intentionally NOT updatable here — see the Rust DTO
 * doc comment.
 */
export type CrmRfqUpdateInput = Partial<
  Omit<CrmRfqCreateInput, 'projectId' | 'fromKind' | 'fromId'>
> & {
  status?: CrmRfqStatus | string;
};

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmRfqListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', String(p.status));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmRfqsApi = {
  list: (params?: CrmRfqListParams) =>
    rustFetch<CrmRfqDoc[]>(`/v1/crm/rfqs${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmRfqDoc>(`/v1/crm/rfqs/${encodeURIComponent(id)}`),
  create: (input: CrmRfqCreateInput) =>
    rustFetch<CrmRfqDoc>('/v1/crm/rfqs', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmRfqUpdateInput) =>
    rustFetch<CrmRfqDoc>(`/v1/crm/rfqs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/rfqs/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),
};
