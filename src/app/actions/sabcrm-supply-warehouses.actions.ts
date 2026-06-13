'use server';

/**
 * SabCRM Supply — warehouses surface server actions (rollout spec WI-3).
 *
 * Full doc-surface adoption for `/sabcrm/supply/warehouses`: paged
 * display-ready rows, KPI strip (network size, active count, total
 * capacity, default warehouse), capped CSV export and full-field
 * create/update over the complete `CreateWarehouseInput` DTO (identity,
 * type, address, manager, tax, capacity, flags).
 *
 * Wire traps honoured here: crm-common-style crate — pagination goes
 * through the supply client's `listPaged` (the SINGLE 0-indexed vs
 * 1-indexed normalizer, spec risk #5); the crate ListQuery natively
 * filters `q` / `status` / `type` / `city`. Status + type are FREE-FORM
 * `Option<String>` on the engine — the vocab constants in the sibling
 * types module are the only guard (spec risk #4).
 *
 * Per-surface get/update/delete siblings live in
 * `sabcrm-supply-docs.actions.ts` and `sabcrm-supply.actions.ts`; this
 * module only adds the verbs the kit needs that those don't carry.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmSupplyWarehousesApi,
  type CrmWarehouseDoc,
} from '@/lib/rust-client/sabcrm-supply';
import type { CrmWarehouseUpdateInput } from '@/lib/rust-client/crm-warehouses';
import { round2 } from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  SABCRM_WAREHOUSE_STATUS_VALUES,
  SABCRM_WAREHOUSE_TYPES,
} from './sabcrm-supply-warehouses.actions.types';
import type {
  SabcrmSupplyWarehouseFullInput,
  SabcrmSupplyWarehouseFullPatch,
  SabcrmSupplyWarehouseKpis,
  SabcrmSupplyWarehouseListFilters,
  SabcrmSupplyWarehouseListPage,
  SabcrmSupplyWarehouseListRow,
} from './sabcrm-supply-warehouses.actions.types';

/* ─── Gate (mirrors sabcrm-supply-docs.actions.ts verbatim) ─────── */

const MODULE_KEY = 'sabcrm';
const WAREHOUSES_PATH = '/sabcrm/supply/warehouses';

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

/* ─── Vocabulary guards ────────────────────────────────────────── */

const TYPE_VALUES = new Set(SABCRM_WAREHOUSE_TYPES.map((t) => t.value));
const STATUS_VALUES = new Set(SABCRM_WAREHOUSE_STATUS_VALUES);

/* ─── Row mapping ──────────────────────────────────────────────── */

function toRow(doc: CrmWarehouseDoc): SabcrmSupplyWarehouseListRow {
  return {
    id: String(doc._id),
    name: doc.name,
    code: doc.code ?? '',
    type: doc.type ?? '',
    status: doc.status ?? 'active',
    address: doc.address ?? '',
    city: doc.city ?? '',
    state: doc.state ?? '',
    country: doc.country ?? '',
    pincode: doc.pincode ?? '',
    phone: doc.phone ?? '',
    managerId: doc.managerId ?? null,
    managerName: doc.managerName?.trim() || null,
    gstin: doc.gstin ?? '',
    capacityUnits: doc.capacityUnits ?? null,
    capacitySqft: doc.capacitySqft ?? null,
    climateControlled: Boolean(doc.climateControlled),
    isDefault: Boolean(doc.isDefault),
    updatedAt: doc.updatedAt ?? doc.createdAt ?? '',
  };
}

/** Date-range post-filter (the crate has no updatedAt bounds). */
function applyDateFilter(
  rows: SabcrmSupplyWarehouseListRow[],
  filters: SabcrmSupplyWarehouseListFilters,
): SabcrmSupplyWarehouseListRow[] {
  if (!filters.from && !filters.to) return rows;
  const fromKey = filters.from ?? '0000-00-00';
  const toKey = filters.to ?? '9999-12-31';
  return rows.filter((r) => {
    const day = r.updatedAt.slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

/* ─── List page / export ───────────────────────────────────────── */

/**
 * Lists a page of display-ready warehouse rows. `q` / `status` / `type`
 * filter on the wire (native crate ListQuery); pagination goes through
 * `listPaged` — never hand-rolled.
 */
export async function listSabcrmSupplyWarehousesPage(
  filters: SabcrmSupplyWarehouseListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmSupplyWarehouseListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmSupplyWarehousesApi.listPaged(g.ctx.projectId, {
      page,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
      type: filters.type || undefined,
    });
    const rows = applyDateFilter(res.items.map(toRow), filters);
    return { ok: true, data: { rows, page, hasMore: res.hasMore } };
  } catch (e) {
    return fail(e, 'Failed to list warehouses.');
  }
}

/** Pages scanned for export/KPIs (100 docs each, 500 cap). */
const SCAN_MAX_PAGES = 5;

/** Fetch-all (capped at 500) for CSV export, honouring current filters. */
export async function exportSabcrmSupplyWarehouseRows(
  filters: SabcrmSupplyWarehouseListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmSupplyWarehouseListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmWarehouseDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmSupplyWarehousesApi.listPaged(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
        type: filters.type || undefined,
      });
      docs.push(...res.items);
      if (!res.hasMore) break;
    }
    return { ok: true, data: applyDateFilter(docs.map(toRow), filters) };
  } catch (e) {
    return fail(e, 'Failed to export warehouses.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/**
 * KPI strip: network size, active count, total declared capacity and
 * the default warehouse — ONE capped scan, `sampled: true` at the cap.
 */
export async function getSabcrmSupplyWarehouseKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmSupplyWarehouseKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmWarehouseDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmSupplyWarehousesApi.listPaged(g.ctx.projectId, {
        page,
        limit: 100,
      });
      docs.push(...res.items);
      if (!res.hasMore) break;
      if (page === SCAN_MAX_PAGES && res.hasMore) sampled = true;
    }

    let activeCount = 0;
    let totalCapacityUnits = 0;
    let climateControlledCount = 0;
    let defaultWarehouseName: string | null = null;
    for (const doc of docs) {
      if ((doc.status ?? 'active') === 'active') activeCount += 1;
      totalCapacityUnits += doc.capacityUnits ?? 0;
      if (doc.climateControlled) climateControlledCount += 1;
      if (doc.isDefault && !defaultWarehouseName) {
        defaultWarehouseName = doc.name;
      }
    }

    return {
      ok: true,
      data: {
        count: docs.length,
        activeCount,
        totalCapacityUnits: round2(totalCapacityUnits),
        climateControlledCount,
        defaultWarehouseName,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute warehouse KPIs.');
  }
}

/* ─── Create / update (full drawer) ────────────────────────────── */

function validateWarehouseInput(
  input: SabcrmSupplyWarehouseFullInput | SabcrmSupplyWarehouseFullPatch,
  requireName: boolean,
): string | null {
  if (requireName || input.name !== undefined) {
    if (!input.name?.trim()) return 'A warehouse name is required.';
  }
  if (input.type !== undefined && input.type && !TYPE_VALUES.has(input.type)) {
    return 'Pick a valid warehouse type.';
  }
  if (
    input.status !== undefined &&
    input.status &&
    !STATUS_VALUES.has(input.status)
  ) {
    return 'Pick a valid warehouse status.';
  }
  for (const [label, value] of [
    ['Capacity (units)', input.capacityUnits],
    ['Capacity (sq ft)', input.capacitySqft],
  ] as const) {
    if (value !== undefined && !Number.isFinite(Number(value))) {
      return `${label} is invalid.`;
    }
  }
  return null;
}

/** Creates a warehouse from the full drawer (every DTO field). */
export async function createSabcrmSupplyWarehouseFull(
  input: SabcrmSupplyWarehouseFullInput,
  projectId?: string,
): Promise<ActionResult<CrmWarehouseDoc>> {
  const problem = validateWarehouseInput(input, true);
  if (problem) return { ok: false, error: problem };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmSupplyWarehousesApi.create(g.ctx.projectId, {
      name: input.name.trim(),
      code: input.code?.trim() || undefined,
      type: input.type || undefined,
      status: input.status || 'active',
      address: input.address?.trim() || undefined,
      city: input.city?.trim() || undefined,
      state: input.state?.trim() || undefined,
      country: input.country?.trim() || undefined,
      pincode: input.pincode?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      managerId: input.managerId || undefined,
      managerName: input.managerName?.trim() || undefined,
      gstin: input.gstin?.trim().toUpperCase() || undefined,
      capacityUnits:
        input.capacityUnits !== undefined
          ? Number(input.capacityUnits)
          : undefined,
      capacitySqft:
        input.capacitySqft !== undefined
          ? Number(input.capacitySqft)
          : undefined,
      climateControlled: input.climateControlled,
      isDefault: input.isDefault,
    });
    revalidatePath(WAREHOUSES_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to create the warehouse.');
  }
}

/** Full-field patch (only the provided keys hit the wire). */
export async function updateSabcrmSupplyWarehouseFull(
  id: string,
  patch: SabcrmSupplyWarehouseFullPatch,
  projectId?: string,
): Promise<ActionResult<CrmWarehouseDoc>> {
  if (!id) return { ok: false, error: 'Warehouse id is required.' };
  const problem = validateWarehouseInput(patch, false);
  if (problem) return { ok: false, error: problem };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: CrmWarehouseUpdateInput = {};
  if (patch.name !== undefined) wire.name = patch.name.trim();
  if (patch.code !== undefined) wire.code = patch.code.trim();
  if (patch.type !== undefined) wire.type = patch.type || undefined;
  if (patch.status !== undefined) {
    wire.status = patch.status || 'active';
    // Keep the legacy archive flag in lockstep with the status vocab.
    wire.archived = patch.status === 'archived';
  }
  if (patch.address !== undefined) wire.address = patch.address.trim();
  if (patch.city !== undefined) wire.city = patch.city.trim();
  if (patch.state !== undefined) wire.state = patch.state.trim();
  if (patch.country !== undefined) wire.country = patch.country.trim();
  if (patch.pincode !== undefined) wire.pincode = patch.pincode.trim();
  if (patch.phone !== undefined) wire.phone = patch.phone.trim();
  if (patch.managerId !== undefined) wire.managerId = patch.managerId;
  if (patch.managerName !== undefined) {
    wire.managerName = patch.managerName.trim();
  }
  if (patch.gstin !== undefined) {
    wire.gstin = patch.gstin.trim().toUpperCase();
  }
  if (patch.capacityUnits !== undefined) {
    wire.capacityUnits = Number(patch.capacityUnits);
  }
  if (patch.capacitySqft !== undefined) {
    wire.capacitySqft = Number(patch.capacitySqft);
  }
  if (patch.climateControlled !== undefined) {
    wire.climateControlled = patch.climateControlled;
  }
  if (patch.isDefault !== undefined) wire.isDefault = patch.isDefault;
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const doc = await sabcrmSupplyWarehousesApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(WAREHOUSES_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the warehouse.');
  }
}
