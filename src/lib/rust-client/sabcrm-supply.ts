import 'server-only';

/**
 * SabCRM Supply client — wraps the project-scoped re-mounts of the
 * legacy CRM inventory + purchasing crates under `/v1/sabcrm/supply/*`
 * (each crate's `project_router` mount in `sabnode-api`).
 *
 * Same handlers, same Mongo collections as the legacy `/v1/crm/*`
 * mounts, but every request must carry the active SabCRM `projectId`
 * (query string for GET/PATCH/DELETE, body for POST) — the Rust side
 * rejects requests without it. Membership of the project is validated
 * by the gated server actions in
 * `src/app/actions/sabcrm-supply.actions.ts` BEFORE calling this
 * client; never call it with an unvalidated projectId.
 *
 * Wire shapes are identical to the legacy mounts, so document/input
 * types are re-used from the per-entity legacy clients (all camelCase,
 * mirroring the `serde(rename_all = "camelCase")` Rust DTOs).
 *
 * Two list envelopes exist (mirror the two crate styles):
 * - crm-common style (items, warehouses, stock-adjustments, vendors,
 *   bom, production-orders): `{ items, page, limit, hasMore }`,
 *   0-indexed pages;
 * - Identity style (purchase-orders, grn, rfqs, vendor-bids): flat
 *   `T[]`, 1-indexed pages.
 * The `list` helpers below normalize both into a plain `T[]` (callers
 * own the page convention). `listPaged` is the SINGLE place the
 * 0-indexed/1-indexed split is normalized for paginated UIs: it takes a
 * caller-facing **1-indexed** page, translates it per envelope style,
 * and always returns `{ items, hasMore }` (crm-common passes the
 * envelope's `hasMore` through; Identity derives it from a full page —
 * `items.length === limit` — exactly like `listSabcrmInvoicesPage`;
 * never probe with `limit + 1`, the Rust skip math would drift).
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */

import { rustFetch } from './fetcher';
import type {
  CrmItemCreateInput,
  CrmItemDoc,
  CrmItemUpdateInput,
} from './crm-items';
import type {
  CrmWarehouseCreateInput,
  CrmWarehouseDoc,
  CrmWarehouseListParams,
  CrmWarehouseUpdateInput,
} from './crm-warehouses';
import type {
  CrmStockAdjustmentCreateInput,
  CrmStockAdjustmentDoc,
  CrmStockAdjustmentListParams,
  CrmStockAdjustmentUpdateInput,
} from './crm-stock-adjustments';
import type {
  CrmPurchaseOrderCreateInput,
  CrmPurchaseOrderDoc,
  CrmPurchaseOrderListParams,
  CrmPurchaseOrderUpdateInput,
} from './crm-purchase-orders';
import type {
  CrmGrnCreateInput,
  CrmGrnDoc,
  CrmGrnListParams,
  CrmGrnUpdateInput,
} from './crm-grns';
import type {
  CrmVendorCreateInput,
  CrmVendorDoc,
  CrmVendorUpdateInput,
} from './crm-vendors';
import type {
  CrmRfqCreateInput,
  CrmRfqDoc,
  CrmRfqListParams,
  CrmRfqUpdateInput,
} from './crm-rfqs';
import type {
  CrmVendorBidCreateInput,
  CrmVendorBidDoc,
  CrmVendorBidListParams,
  CrmVendorBidUpdateInput,
} from './crm-vendor-bids';
import type {
  CrmBomCreateInput,
  CrmBomDoc,
  CrmBomListParams,
  CrmBomUpdateInput,
} from './crm-bom';
import type {
  CrmProductionOrderCreateInput,
  CrmProductionOrderDoc,
  CrmProductionOrderListParams,
  CrmProductionOrderUpdateInput,
} from './crm-production-orders';

/* ─── Re-exported wire types (same Rust DTOs as the legacy mounts) ── */

export type {
  CrmItemDoc,
  CrmWarehouseDoc,
  CrmStockAdjustmentDoc,
  CrmPurchaseOrderDoc,
  CrmGrnDoc,
  CrmVendorDoc,
  CrmRfqDoc,
  CrmVendorBidDoc,
  CrmBomDoc,
  CrmProductionOrderDoc,
};

/** Generic list params accepted by every supply list endpoint. */
export interface SabcrmSupplyListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  [key: string]: string | number | undefined;
}

/**
 * Normalized page returned by {@link SupplyClient.listPaged} —
 * the `{ rows, hasMore }` contract `DocListPage.fetchPage` needs,
 * regardless of which envelope style the crate speaks.
 */
export interface SabcrmSupplyPage<T> {
  items: T[];
  hasMore: boolean;
}

/**
 * `POST` bodies sans `projectId` — the client injects the validated
 * project scope itself so callers can't smuggle a different tenant in.
 */
export type SabcrmItemCreateInput = CrmItemCreateInput;
export type SabcrmWarehouseCreateInput = CrmWarehouseCreateInput;
export type SabcrmStockAdjustmentCreateInput = CrmStockAdjustmentCreateInput;
export type SabcrmPurchaseOrderCreateInput = Omit<
  CrmPurchaseOrderCreateInput,
  'projectId'
>;
export type SabcrmGrnCreateInput = Omit<CrmGrnCreateInput, 'projectId'>;
export type SabcrmVendorCreateInput = CrmVendorCreateInput;
export type SabcrmRfqCreateInput = Omit<CrmRfqCreateInput, 'projectId'>;
export type SabcrmVendorBidCreateInput = Omit<
  CrmVendorBidCreateInput,
  'projectId'
>;
export type SabcrmBomCreateInput = CrmBomCreateInput;
export type SabcrmProductionOrderCreateInput = CrmProductionOrderCreateInput;

/* ─── Internals ─────────────────────────────────────────────────── */

/** Encode query params, dropping undefined/empty values. */
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/**
 * Normalize the two list envelopes (`T[]` from Identity-style crates,
 * `{ items: T[] }` from crm-common-style crates) into a plain `T[]`.
 */
function normalizeList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const env = raw as Record<string, unknown>;
    if (Array.isArray(env.items)) return env.items as T[];
  }
  return [];
}

/**
 * Normalize the two create envelopes (`{ id, entity }` from
 * crm-common-style crates, the bare doc from Identity-style crates)
 * into the created document.
 */
function normalizeCreated<T>(raw: unknown): T {
  if (raw && typeof raw === 'object') {
    const env = raw as Record<string, unknown>;
    if (env.entity && typeof env.entity === 'object') return env.entity as T;
  }
  return raw as T;
}

/** Normalize `{ deleted }` / `{ ok, deleted }` delete envelopes. */
function normalizeDeleted(raw: unknown): { deleted: boolean } {
  if (raw && typeof raw === 'object') {
    const env = raw as Record<string, unknown>;
    if (typeof env.deleted === 'boolean') return { deleted: env.deleted };
    if (typeof env.ok === 'boolean') return { deleted: env.ok };
  }
  return { deleted: true };
}

/**
 * Which list envelope the crate behind a mount speaks. Drives the
 * page-index translation + `hasMore` derivation in `listPaged`.
 */
type SupplyEnvelopeStyle = 'crm-common' | 'identity';

interface SupplyClient<TDoc, TCreate, TUpdate> {
  list(projectId: string, params?: SabcrmSupplyListParams): Promise<TDoc[]>;
  /**
   * Paginated list with a normalized contract. `params.page` is
   * **1-indexed** (UI convention) no matter the crate: crm-common
   * mounts get `page - 1` on the wire (their pages are 0-indexed),
   * Identity mounts get it verbatim. `hasMore` comes from the
   * crm-common envelope when present, else from a full page
   * (`items.length === limit`). Never hand-roll pagination in actions —
   * this is the single normalizer (supply-commerce rollout spec WI-1.2).
   */
  listPaged(
    projectId: string,
    params?: SabcrmSupplyListParams,
  ): Promise<SabcrmSupplyPage<TDoc>>;
  getById(projectId: string, id: string): Promise<TDoc>;
  create(projectId: string, input: TCreate): Promise<TDoc>;
  update(projectId: string, id: string, patch: TUpdate): Promise<TDoc>;
  delete(projectId: string, id: string): Promise<{ deleted: boolean }>;
}

/** Default + max page size for `listPaged` (crate MAX_LIMIT is 100). */
const PAGED_DEFAULT_LIMIT = 25;
const PAGED_MAX_LIMIT = 100;

/**
 * Build a project-scoped client for one `/v1/sabcrm/supply/<entity>`
 * mount. `projectId` is injected on every call (query for
 * GET/PATCH/DELETE, body for POST) — the Rust `project_router` rejects
 * requests without it. `style` declares the crate's list envelope so
 * `listPaged` can normalize page indexing + `hasMore`.
 */
function makeSupplyClient<TDoc, TCreate, TUpdate>(
  entity: string,
  style: SupplyEnvelopeStyle,
): SupplyClient<TDoc, TCreate, TUpdate> {
  const base = `/v1/sabcrm/supply/${entity}`;
  return {
    list: async (projectId, params) =>
      normalizeList<TDoc>(
        await rustFetch<unknown>(`${base}${qs({ ...params, projectId })}`),
      ),
    listPaged: async (projectId, params) => {
      const requested = Math.max(1, Math.floor(Number(params?.page ?? 1)) || 1);
      const limit = Math.min(
        Math.max(
          Math.floor(Number(params?.limit ?? PAGED_DEFAULT_LIMIT)) ||
            PAGED_DEFAULT_LIMIT,
          1,
        ),
        PAGED_MAX_LIMIT,
      );
      // The ONLY place the 0-indexed (crm-common) vs 1-indexed
      // (Identity) split is translated.
      const wirePage = style === 'crm-common' ? requested - 1 : requested;
      const raw = await rustFetch<unknown>(
        `${base}${qs({ ...params, page: wirePage, limit, projectId })}`,
      );
      const items = normalizeList<TDoc>(raw);
      let hasMore = items.length === limit;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const env = raw as Record<string, unknown>;
        if (typeof env.hasMore === 'boolean') hasMore = env.hasMore;
      }
      return { items, hasMore };
    },
    getById: (projectId, id) =>
      rustFetch<TDoc>(`${base}/${encodeURIComponent(id)}${qs({ projectId })}`),
    create: async (projectId, input) =>
      normalizeCreated<TDoc>(
        await rustFetch<unknown>(base, {
          method: 'POST',
          body: JSON.stringify({ ...input, projectId }),
        }),
      ),
    update: (projectId, id, patch) =>
      rustFetch<TDoc>(`${base}/${encodeURIComponent(id)}${qs({ projectId })}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    delete: async (projectId, id) =>
      normalizeDeleted(
        await rustFetch<unknown>(
          `${base}/${encodeURIComponent(id)}${qs({ projectId })}`,
          { method: 'DELETE' },
        ),
      ),
  };
}

/* ─── Per-entity clients ────────────────────────────────────────── */

/** `crm-items` → `/v1/sabcrm/supply/items` (crm-common style). */
export const sabcrmSupplyItemsApi = makeSupplyClient<
  CrmItemDoc,
  SabcrmItemCreateInput,
  CrmItemUpdateInput
>('items', 'crm-common');

/** `crm-warehouses` → `/v1/sabcrm/supply/warehouses` (crm-common style). */
export const sabcrmSupplyWarehousesApi = makeSupplyClient<
  CrmWarehouseDoc,
  SabcrmWarehouseCreateInput,
  CrmWarehouseUpdateInput
>('warehouses', 'crm-common');

/** `crm-stock-adjustments` → `/v1/sabcrm/supply/stock-adjustments`. */
export const sabcrmSupplyStockAdjustmentsApi = makeSupplyClient<
  CrmStockAdjustmentDoc,
  SabcrmStockAdjustmentCreateInput,
  CrmStockAdjustmentUpdateInput
>('stock-adjustments', 'crm-common');

/** `crm-purchase-orders` → `/v1/sabcrm/supply/purchase-orders` (Identity style). */
export const sabcrmSupplyPurchaseOrdersApi = makeSupplyClient<
  CrmPurchaseOrderDoc,
  SabcrmPurchaseOrderCreateInput,
  CrmPurchaseOrderUpdateInput
>('purchase-orders', 'identity');

/** `crm-grns` → `/v1/sabcrm/supply/grn` (Identity style). */
export const sabcrmSupplyGrnsApi = makeSupplyClient<
  CrmGrnDoc,
  SabcrmGrnCreateInput,
  CrmGrnUpdateInput
>('grn', 'identity');

/** `crm-vendors` → `/v1/sabcrm/supply/vendors` (crm-common style). */
export const sabcrmSupplyVendorsApi = makeSupplyClient<
  CrmVendorDoc,
  SabcrmVendorCreateInput,
  CrmVendorUpdateInput
>('vendors', 'crm-common');

/** `crm-rfqs` → `/v1/sabcrm/supply/rfqs` (Identity style). */
export const sabcrmSupplyRfqsApi = makeSupplyClient<
  CrmRfqDoc,
  SabcrmRfqCreateInput,
  CrmRfqUpdateInput
>('rfqs', 'identity');

/** `crm-vendor-bids` → `/v1/sabcrm/supply/vendor-bids` (Identity style). */
export const sabcrmSupplyVendorBidsApi = makeSupplyClient<
  CrmVendorBidDoc,
  SabcrmVendorBidCreateInput,
  CrmVendorBidUpdateInput
>('vendor-bids', 'identity');

/** `crm-bom` → `/v1/sabcrm/supply/bom` (crm-common style). */
export const sabcrmSupplyBomApi = makeSupplyClient<
  CrmBomDoc,
  SabcrmBomCreateInput,
  CrmBomUpdateInput
>('bom', 'crm-common');

/** `crm-production-orders` → `/v1/sabcrm/supply/production-orders`. */
export const sabcrmSupplyProductionOrdersApi = makeSupplyClient<
  CrmProductionOrderDoc,
  SabcrmProductionOrderCreateInput,
  CrmProductionOrderUpdateInput
>('production-orders', 'crm-common');

/* Unused list-param aliases kept for narrow typing at call sites. */
export type {
  CrmWarehouseListParams,
  CrmStockAdjustmentListParams,
  CrmPurchaseOrderListParams,
  CrmGrnListParams,
  CrmRfqListParams,
  CrmVendorBidListParams,
  CrmBomListParams,
  CrmProductionOrderListParams,
};
