'use server';

/**
 * SabCRM Supply — stock-adjustments surface server actions (rollout
 * WI-4).
 *
 * Full doc-surface adoption for `/sabcrm/supply/stock-adjustments`:
 * paged display-ready rows (warehouse + product ids batch-resolved to
 * labels — never a raw ObjectId), KPI strip (count, draft/approved
 * split, approved value, net units), capped CSV export and full-field
 * create/update over the `CrmStockAdjustmentCreateInput` DTO.
 *
 * Wire traps honoured here (spec §1.3 / risk #5): `crm-stock-adjustments`
 * is a crm-common-style crate — pagination goes through the supply
 * client's `listPaged`, the SINGLE 0-indexed/1-indexed normalizer. The
 * crate stores free-form `Option<String>` status (spec risk #4): the UI
 * vocab (`SABCRM_STOCK_ADJUSTMENT_*`) is the only guard, so `status` is
 * written via a loose cast. Approve/cancel transitions + get/update live
 * in the shared `sabcrm-supply-docs.actions.ts`; this module adds the
 * list/export/KPI/create/update verbs the kit needs.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmSupplyItemsApi,
  sabcrmSupplyStockAdjustmentsApi,
  sabcrmSupplyWarehousesApi,
} from '@/lib/rust-client/sabcrm-supply';
import type { SabcrmSupplyListParams } from '@/lib/rust-client/sabcrm-supply';
import type {
  CrmStockAdjustmentCreateInput,
  CrmStockAdjustmentDoc,
} from '@/lib/rust-client/crm-stock-adjustments';
import { round2 } from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { SabcrmStockAdjustmentStatus } from './sabcrm-supply-docs.actions.types';
import type {
  SabcrmSupplyStockAdjustmentFullInput,
  SabcrmSupplyStockAdjustmentFullPatch,
  SabcrmSupplyStockAdjustmentKpis,
  SabcrmSupplyStockAdjustmentListFilters,
  SabcrmSupplyStockAdjustmentListPage,
  SabcrmSupplyStockAdjustmentListRow,
} from './sabcrm-supply-stock-adjustments.actions.types';

/* ─── Gate (mirrors sabcrm-supply-docs.actions.ts verbatim) ───────── */

const MODULE_KEY = 'sabcrm';
const ADJ_PATH = '/sabcrm/supply/stock-adjustments';

interface SessionUser {
  _id: string;
}

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }

  const allowed = await canServer(MODULE_KEY, action, requested);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId: requested } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/* ─── Label resolution (batch — never N+1, spec risk #6) ──────────── */

async function resolveLabels(
  projectId: string,
  warehouseIds: string[],
  productIds: string[],
): Promise<{
  warehouses: Map<string, string>;
  products: Map<string, string>;
}> {
  const warehouses = new Map<string, string>();
  const products = new Map<string, string>();
  await Promise.all([
    ...[...new Set(warehouseIds.filter(Boolean))].map(async (id) => {
      try {
        const w = await sabcrmSupplyWarehousesApi.getById(projectId, id);
        warehouses.set(id, w.name || 'Unnamed warehouse');
      } catch {
        // gone — row renders "Unknown warehouse"
      }
    }),
    ...[...new Set(productIds.filter(Boolean))].map(async (id) => {
      try {
        const p = await sabcrmSupplyItemsApi.getById(projectId, id);
        products.set(id, p.name || p.sku || 'Unnamed item');
      } catch {
        // gone — row renders "Unknown item"
      }
    }),
  ]);
  return { warehouses, products };
}

function toRow(
  doc: CrmStockAdjustmentDoc,
  warehouses: Map<string, string>,
  products: Map<string, string>,
): SabcrmSupplyStockAdjustmentListRow {
  return {
    id: String(doc._id),
    adjustmentNumber: doc.adjustmentNumber ?? '',
    date: doc.date ?? '',
    reason: doc.reason ?? '',
    referenceNumber: doc.referenceNumber ?? '',
    warehouseId: doc.warehouseId ?? '',
    warehouseLabel: doc.warehouseId
      ? (warehouses.get(doc.warehouseId) ?? null)
      : null,
    productId: doc.productId ?? '',
    productLabel: doc.productId ? (products.get(doc.productId) ?? null) : null,
    quantity: doc.quantity ?? 0,
    costPerUnit: doc.costPerUnit ?? null,
    status: (doc.status ?? 'draft') as SabcrmStockAdjustmentStatus,
    approvedByName: doc.approvedByName?.trim() || null,
    notes: doc.notes ?? '',
  };
}

/**
 * The crate's typed `status` union (pending/approved/rejected) doesn't
 * cover the free-form UI vocab (draft/approved/cancelled); the wire is
 * built loosely and cast. `all`/'' ⇒ omit the filter.
 */
function buildListParams(
  filters: SabcrmSupplyStockAdjustmentListFilters,
  page: number,
  limit: number,
): SabcrmSupplyListParams {
  const params: SabcrmSupplyListParams = { page, limit };
  if (filters.q) params.q = filters.q;
  if (filters.status) params.status = filters.status;
  if (filters.warehouseId) params.warehouseId = filters.warehouseId;
  if (filters.productId) params.productId = filters.productId;
  if (filters.from) params.dateFrom = filters.from;
  if (filters.to) params.dateTo = filters.to;
  return params;
}

/* ─── List page / export ──────────────────────────────────────────── */

/** Lists a page of display-ready adjustment rows (labels resolved). */
export async function listSabcrmSupplyStockAdjustmentsPage(
  filters: SabcrmSupplyStockAdjustmentListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmSupplyStockAdjustmentListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmSupplyStockAdjustmentsApi.listPaged(
      g.ctx.projectId,
      buildListParams(filters, page, limit),
    );
    const labels = await resolveLabels(
      g.ctx.projectId,
      res.items.map((d) => d.warehouseId),
      res.items.map((d) => d.productId),
    );
    const rows = res.items.map((doc) =>
      toRow(doc, labels.warehouses, labels.products),
    );
    return { ok: true, data: { rows, page, hasMore: res.hasMore } };
  } catch (e) {
    return fail(e, 'Failed to list stock adjustments.');
  }
}

/** Pages scanned for export/KPIs (100 docs each, 500 cap). */
const SCAN_MAX_PAGES = 5;

/** Fetch-all (capped at 500) for CSV export, honouring current filters. */
export async function exportSabcrmSupplyStockAdjustmentRows(
  filters: SabcrmSupplyStockAdjustmentListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmSupplyStockAdjustmentListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmStockAdjustmentDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmSupplyStockAdjustmentsApi.listPaged(
        g.ctx.projectId,
        buildListParams(filters, page, 100),
      );
      docs.push(...res.items);
      if (!res.hasMore) break;
    }
    const labels = await resolveLabels(
      g.ctx.projectId,
      docs.map((d) => d.warehouseId),
      docs.map((d) => d.productId),
    );
    const rows = docs.map((doc) =>
      toRow(doc, labels.warehouses, labels.products),
    );
    return { ok: true, data: rows };
  } catch (e) {
    return fail(e, 'Failed to export stock adjustments.');
  }
}

/* ─── KPIs ────────────────────────────────────────────────────────── */

/** KPI strip: count, draft/approved split, approved value, net units. */
export async function getSabcrmSupplyStockAdjustmentKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmSupplyStockAdjustmentKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmStockAdjustmentDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmSupplyStockAdjustmentsApi.listPaged(
        g.ctx.projectId,
        { page, limit: 100 },
      );
      docs.push(...res.items);
      if (!res.hasMore) break;
      if (page === SCAN_MAX_PAGES && res.hasMore) sampled = true;
    }

    let draftCount = 0;
    let approvedCount = 0;
    let approvedValue = 0;
    let netUnits = 0;
    for (const doc of docs) {
      const status = doc.status ?? 'draft';
      if (status === 'approved') {
        approvedCount += 1;
        approvedValue +=
          Math.abs(doc.quantity ?? 0) * (doc.costPerUnit ?? 0);
      } else if (status === 'draft') {
        draftCount += 1;
      }
      netUnits += doc.quantity ?? 0;
    }

    return {
      ok: true,
      data: {
        count: docs.length,
        draftCount,
        approvedCount,
        approvedValue: round2(approvedValue),
        netUnits: round2(netUnits),
        currency: 'INR',
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute adjustment KPIs.');
  }
}

/* ─── Create / update (full DocForm) ──────────────────────────────── */

function validateInput(
  input:
    | SabcrmSupplyStockAdjustmentFullInput
    | SabcrmSupplyStockAdjustmentFullPatch,
  requireRequired: boolean,
): string | null {
  if (requireRequired || input.reason !== undefined) {
    if (!input.reason?.trim()) return 'A reason is required.';
  }
  if (requireRequired || input.warehouseId !== undefined) {
    if (!input.warehouseId) return 'Pick a warehouse.';
  }
  if (requireRequired || input.productId !== undefined) {
    if (!input.productId) return 'Pick a product.';
  }
  if (requireRequired || input.quantity !== undefined) {
    if (
      input.quantity === undefined ||
      !Number.isFinite(Number(input.quantity)) ||
      Number(input.quantity) === 0
    ) {
      return 'Quantity must be a non-zero number (negative for stock out).';
    }
  }
  if (
    input.costPerUnit !== undefined &&
    input.costPerUnit !== null &&
    !Number.isFinite(Number(input.costPerUnit))
  ) {
    return 'Cost per unit is invalid.';
  }
  return null;
}

/** Creates a stock adjustment (drafts by default — the form issues it). */
export async function createSabcrmSupplyStockAdjustmentFull(
  input: SabcrmSupplyStockAdjustmentFullInput,
  projectId?: string,
): Promise<ActionResult<CrmStockAdjustmentDoc>> {
  const problem = validateInput(input, true);
  if (problem) return { ok: false, error: problem };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    // The crate stores free-form `Option<String>` status; the typed DTO
    // union (pending/approved/rejected) doesn't cover the UI vocab, so
    // the wire is built loosely and cast at the boundary (spec risk #4).
    const wire = {
      adjustmentNumber: input.adjustmentNumber?.trim() || undefined,
      date: input.date || undefined,
      reason: input.reason.trim(),
      referenceNumber: input.referenceNumber?.trim() || undefined,
      warehouseId: input.warehouseId,
      productId: input.productId,
      quantity: Number(input.quantity),
      costPerUnit:
        input.costPerUnit !== undefined && input.costPerUnit !== null
          ? round2(Number(input.costPerUnit))
          : undefined,
      notes: input.notes?.trim() || undefined,
      status: 'draft', // UI vocab default
    };
    const doc = await sabcrmSupplyStockAdjustmentsApi.create(
      g.ctx.projectId,
      wire as unknown as CrmStockAdjustmentCreateInput,
    );
    revalidatePath(ADJ_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to create the stock adjustment.');
  }
}

/** Full-field patch (only the provided keys hit the wire). */
export async function updateSabcrmSupplyStockAdjustmentFull(
  id: string,
  patch: SabcrmSupplyStockAdjustmentFullPatch,
  projectId?: string,
): Promise<ActionResult<CrmStockAdjustmentDoc>> {
  if (!id) return { ok: false, error: 'Adjustment id is required.' };
  const problem = validateInput(patch, false);
  if (problem) return { ok: false, error: problem };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: Record<string, unknown> = {};
  if (patch.adjustmentNumber !== undefined) {
    wire.adjustmentNumber = patch.adjustmentNumber.trim();
  }
  if (patch.date !== undefined) wire.date = patch.date;
  if (patch.reason !== undefined) wire.reason = patch.reason.trim();
  if (patch.referenceNumber !== undefined) {
    wire.referenceNumber = patch.referenceNumber.trim();
  }
  if (patch.warehouseId !== undefined) wire.warehouseId = patch.warehouseId;
  if (patch.productId !== undefined) wire.productId = patch.productId;
  if (patch.quantity !== undefined) wire.quantity = Number(patch.quantity);
  if (patch.costPerUnit !== undefined) {
    wire.costPerUnit =
      patch.costPerUnit === null ? undefined : round2(Number(patch.costPerUnit));
  }
  if (patch.notes !== undefined) wire.notes = patch.notes.trim();
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const doc = await sabcrmSupplyStockAdjustmentsApi.update(
      g.ctx.projectId,
      id,
      wire as unknown as CrmStockAdjustmentCreateInput,
    );
    revalidatePath(ADJ_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the stock adjustment.');
  }
}
