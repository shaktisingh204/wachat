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

/* ─── Wire normalization ──────────────────────────────────────── */

/**
 * The Rust BFF serializes its `ObjectId` / `DateTime<Utc>` fields with
 * the BSON-native serde impls, so they arrive over the wire as MongoDB
 * **extended JSON** objects rather than plain scalars:
 *
 *   - `_id` / `itemId` / vendor ids → `{ "$oid": "507f…" }`
 *   - `requiredBy` / `deadline` / `createdAt` → `{ "$date": "2026-…Z" }`
 *     (or the canonical `{ "$date": { "$numberLong": "…" } }` form).
 *
 * Left untouched these would `String()`-stringify to `"[object Object]"`
 * — which is exactly what was reaching the RFQ detail route
 * (`/rfqs/[object%20Object]`) and breaking date rendering. We flatten
 * both forms back into the TS-friendly scalars the `CrmRfqDoc` shape
 * advertises before any UI / action code touches the document.
 */
function deflateExtJson(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value;

  if (Array.isArray(value)) return value.map(deflateExtJson);

  const obj = value as Record<string, unknown>;

  // { $oid: "hex" } → "hex"
  if (typeof obj.$oid === 'string' && Object.keys(obj).length === 1) {
    return obj.$oid;
  }

  // { $date: "iso" } | { $date: { $numberLong: "ms" } } → ISO string
  if ('$date' in obj && Object.keys(obj).length === 1) {
    const d = obj.$date;
    if (typeof d === 'string') return d;
    if (
      d != null &&
      typeof d === 'object' &&
      typeof (d as { $numberLong?: unknown }).$numberLong === 'string'
    ) {
      const ms = Number((d as { $numberLong: string }).$numberLong);
      return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
    }
    return undefined;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = deflateExtJson(v);
  }
  return out;
}

/** Deflate a single RFQ doc's extended-JSON scalars in place. */
function normalizeRfqDoc(doc: CrmRfqDoc): CrmRfqDoc {
  return deflateExtJson(doc) as CrmRfqDoc;
}

/**
 * The RFQ Rust DTO deserializes `requiredBy` / `deadline` with bson's
 * `chrono_datetime_as_bson_datetime_optional` helper, which only accepts
 * the BSON extended-JSON datetime form — a bare RFC3339 string
 * (`"2026-06-03T00:00:00Z"`) is rejected with a 422 (`expecting
 * DateTime`). Sibling modules (e.g. Purchase Orders) get away with plain
 * strings because their DTO uses chrono-native serde; RFQs do not.
 *
 * We wrap any non-empty date string as `{ "$date": "<rfc3339>" }` right
 * before the request leaves the client. Empty / absent dates are left
 * untouched so `JSON.stringify` drops them and the field stays `None`.
 */
function toBsonDate(value: unknown): unknown {
  if (typeof value !== 'string' || value.trim() === '') return value;
  return { $date: value };
}

function encodeRfqDates<
  T extends { requiredBy?: string; deadline?: string },
>(input: T): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  if (input.requiredBy != null) out.requiredBy = toBsonDate(input.requiredBy);
  if (input.deadline != null) out.deadline = toBsonDate(input.deadline);
  return out;
}

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
  list: async (params?: CrmRfqListParams) => {
    const rows = await rustFetch<CrmRfqDoc[]>(
      `/v1/crm/rfqs${buildListQuery(params)}`,
    );
    return Array.isArray(rows) ? rows.map(normalizeRfqDoc) : [];
  },
  getById: async (id: string) =>
    normalizeRfqDoc(
      await rustFetch<CrmRfqDoc>(`/v1/crm/rfqs/${encodeURIComponent(id)}`),
    ),
  create: async (input: CrmRfqCreateInput) =>
    normalizeRfqDoc(
      await rustFetch<CrmRfqDoc>('/v1/crm/rfqs', {
        method: 'POST',
        body: JSON.stringify(encodeRfqDates(input)),
      }),
    ),
  update: async (id: string, patch: CrmRfqUpdateInput) =>
    normalizeRfqDoc(
      await rustFetch<CrmRfqDoc>(`/v1/crm/rfqs/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(encodeRfqDates(patch)),
      }),
    ),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/rfqs/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),
};
