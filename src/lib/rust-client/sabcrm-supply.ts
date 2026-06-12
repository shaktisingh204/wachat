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
 * The `list` helpers below normalize both into a plain `T[]`.
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

interface SupplyClient<TDoc, TCreate, TUpdate> {
  list(projectId: string, params?: SabcrmSupplyListParams): Promise<TDoc[]>;
  getById(projectId: string, id: string): Promise<TDoc>;
  create(projectId: string, input: TCreate): Promise<TDoc>;
  update(projectId: string, id: string, patch: TUpdate): Promise<TDoc>;
  delete(projectId: string, id: string): Promise<{ deleted: boolean }>;
}

/**
 * Build a project-scoped client for one `/v1/sabcrm/supply/<entity>`
 * mount. `projectId` is injected on every call (query for
 * GET/PATCH/DELETE, body for POST) — the Rust `project_router` rejects
 * requests without it.
 */
function makeSupplyClient<TDoc, TCreate, TUpdate>(
  entity: string,
): SupplyClient<TDoc, TCreate, TUpdate> {
  const base = `/v1/sabcrm/supply/${entity}`;
  return {
    list: async (projectId, params) =>
      normalizeList<TDoc>(
        await rustFetch<unknown>(`${base}${qs({ ...params, projectId })}`),
      ),
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
>('items');

/** `crm-warehouses` → `/v1/sabcrm/supply/warehouses` (crm-common style). */
export const sabcrmSupplyWarehousesApi = makeSupplyClient<
  CrmWarehouseDoc,
  SabcrmWarehouseCreateInput,
  CrmWarehouseUpdateInput
>('warehouses');

/** `crm-stock-adjustments` → `/v1/sabcrm/supply/stock-adjustments`. */
export const sabcrmSupplyStockAdjustmentsApi = makeSupplyClient<
  CrmStockAdjustmentDoc,
  SabcrmStockAdjustmentCreateInput,
  CrmStockAdjustmentUpdateInput
>('stock-adjustments');

/** `crm-purchase-orders` → `/v1/sabcrm/supply/purchase-orders` (Identity style). */
export const sabcrmSupplyPurchaseOrdersApi = makeSupplyClient<
  CrmPurchaseOrderDoc,
  SabcrmPurchaseOrderCreateInput,
  CrmPurchaseOrderUpdateInput
>('purchase-orders');

/** `crm-grns` → `/v1/sabcrm/supply/grn` (Identity style). */
export const sabcrmSupplyGrnsApi = makeSupplyClient<
  CrmGrnDoc,
  SabcrmGrnCreateInput,
  CrmGrnUpdateInput
>('grn');

/** `crm-vendors` → `/v1/sabcrm/supply/vendors` (crm-common style). */
export const sabcrmSupplyVendorsApi = makeSupplyClient<
  CrmVendorDoc,
  SabcrmVendorCreateInput,
  CrmVendorUpdateInput
>('vendors');

/** `crm-rfqs` → `/v1/sabcrm/supply/rfqs` (Identity style). */
export const sabcrmSupplyRfqsApi = makeSupplyClient<
  CrmRfqDoc,
  SabcrmRfqCreateInput,
  CrmRfqUpdateInput
>('rfqs');

/** `crm-vendor-bids` → `/v1/sabcrm/supply/vendor-bids` (Identity style). */
export const sabcrmSupplyVendorBidsApi = makeSupplyClient<
  CrmVendorBidDoc,
  SabcrmVendorBidCreateInput,
  CrmVendorBidUpdateInput
>('vendor-bids');

/** `crm-bom` → `/v1/sabcrm/supply/bom` (crm-common style). */
export const sabcrmSupplyBomApi = makeSupplyClient<
  CrmBomDoc,
  SabcrmBomCreateInput,
  CrmBomUpdateInput
>('bom');

/** `crm-production-orders` → `/v1/sabcrm/supply/production-orders`. */
export const sabcrmSupplyProductionOrdersApi = makeSupplyClient<
  CrmProductionOrderDoc,
  SabcrmProductionOrderCreateInput,
  CrmProductionOrderUpdateInput
>('production-orders');

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
