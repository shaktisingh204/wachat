'use server';

/**
 * SabCRM Supply — Production-order surface server actions (rollout WI-11).
 *
 * The doc-surface-kit data paths for `/sabcrm/supply/production-orders`:
 *
 *   - paged list rows (server-rolled material/total cost);
 *   - KPI strip (planned / in progress / completed this month / units
 *     yielded);
 *   - capped fetch-all for CSV export;
 *   - full-form create/update with a server-computed material + total
 *     cost;
 *   - a BOM prefill resolver for the "Start production → order" convert.
 *
 * Get + status transitions (incl. the complete-with-yield/scrap variant)
 * live in the shared module (`sabcrm-supply-docs.actions.ts`). The crate
 * is crm-common style and stores free-form status — the UI vocab is the
 * only guard.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmSupplyProductionOrdersApi,
  sabcrmSupplyBomApi,
  type CrmProductionOrderDoc,
} from '@/lib/rust-client/sabcrm-supply';
import type {
  CrmProductionComponent,
  CrmProductionOrderCreateInput,
  CrmProductionOrderUpdateInput,
} from '@/lib/rust-client/crm-production-orders';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { SabcrmProductionOrderStatus } from './sabcrm-supply-docs.actions.types';
import type {
  SabcrmProductionComponentInput,
  SabcrmProductionOrderBomPrefill,
  SabcrmProductionOrderFullInput,
  SabcrmProductionOrderFullPatch,
  SabcrmProductionOrderKpis,
  SabcrmProductionOrderListFilters,
  SabcrmProductionOrderListPage,
  SabcrmProductionOrderListRow,
} from './sabcrm-supply-production-orders.actions.types';

/* ─── Gate ─────────────────────────────────────────────────────── */

const MODULE_KEY = 'sabcrm';
const MO_PATH = '/sabcrm/supply/production-orders';

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

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toIso(raw: string): string | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ─── Cost rollup + wire mapping ───────────────────────────────── */

function toWireComponent(
  c: SabcrmProductionComponentInput,
): CrmProductionComponent | string {
  const name = (c.itemName ?? '').trim();
  if (!name) return 'Every component needs a name.';
  const qty = Number(c.qty);
  if (!Number.isFinite(qty) || qty <= 0) {
    return `Component "${name}" needs a positive quantity.`;
  }
  return {
    itemId: c.itemId && ObjectId.isValid(c.itemId) ? c.itemId : undefined,
    itemName: name,
    qty,
    unit: (c.unit ?? '').trim() || 'unit',
    scrapPct:
      Number.isFinite(c.scrapPct) && (c.scrapPct ?? 0) > 0
        ? Number(c.scrapPct)
        : undefined,
    costPerUnit:
      Number.isFinite(c.costPerUnit) && (c.costPerUnit ?? 0) > 0
        ? Number(c.costPerUnit)
        : undefined,
  };
}

function buildComponents(
  components: SabcrmProductionComponentInput[],
):
  | { components: CrmProductionComponent[]; materialCost: number }
  | { error: string } {
  const meaningful = (components ?? []).filter((c) => (c.itemName ?? '').trim());
  if (meaningful.length === 0) {
    return { error: 'Add at least one component.' };
  }
  const out: CrmProductionComponent[] = [];
  let materialCost = 0;
  for (const c of meaningful) {
    const wire = toWireComponent(c);
    if (typeof wire === 'string') return { error: wire };
    out.push(wire);
    materialCost += (wire.qty ?? 0) * (wire.costPerUnit ?? 0);
  }
  return { components: out, materialCost: round2(materialCost) };
}

/* ─── List page ────────────────────────────────────────────────── */

function moTotalCost(doc: CrmProductionOrderDoc): number {
  if (typeof doc.totalCost === 'number' && doc.totalCost > 0) {
    return doc.totalCost;
  }
  const material =
    doc.materialCost ??
    (doc.components ?? []).reduce(
      (s, c) => s + (c.qty ?? 0) * (c.costPerUnit ?? 0),
      0,
    );
  return round2(material + (doc.labourCost ?? 0) + (doc.overheadCost ?? 0));
}

function toListRow(doc: CrmProductionOrderDoc): SabcrmProductionOrderListRow {
  return {
    id: doc._id,
    orderNo: doc.orderNo,
    finishedGoodName: doc.finishedGoodName,
    plannedQty: doc.plannedQty ?? 0,
    actualYield: doc.actualYield ?? 0,
    scrap: doc.scrap ?? 0,
    unit: doc.unit ?? '',
    plannedStart: doc.plannedStart ?? null,
    plannedEnd: doc.plannedEnd ?? null,
    machineOperator: doc.machineOperator ?? null,
    totalCost: moTotalCost(doc),
    status: (doc.status ?? 'planned') as SabcrmProductionOrderStatus,
  };
}

function applyDateRange(
  docs: CrmProductionOrderDoc[],
  from?: string,
  to?: string,
): CrmProductionOrderDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.plannedStart ?? d.createdAt ?? '').slice(0, 10);
    return !day || (day >= fromKey && day <= toKey);
  });
}

export async function listSabcrmSupplyProductionOrdersPage(
  filters: SabcrmProductionOrderListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmProductionOrderListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const { items, hasMore } = await sabcrmSupplyProductionOrdersApi.listPaged(
      g.ctx.projectId,
      {
        page,
        limit,
        q: filters.q || undefined,
        status: filters.status || undefined,
      },
    );
    const pageDocs = applyDateRange(items, filters.from, filters.to);
    return {
      ok: true,
      data: { rows: pageDocs.map(toListRow), page, hasMore },
    };
  } catch (e) {
    return fail(e, 'Failed to list production orders.');
  }
}

const SCAN_MAX_PAGES = 5;

export async function exportSabcrmSupplyProductionOrderRows(
  filters: SabcrmProductionOrderListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmProductionOrderListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmProductionOrderDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const { items, hasMore } =
        await sabcrmSupplyProductionOrdersApi.listPaged(g.ctx.projectId, {
          page,
          limit: 100,
          q: filters.q || undefined,
          status: filters.status || undefined,
        });
      docs.push(...items);
      if (!hasMore) break;
    }
    const rows = applyDateRange(docs, filters.from, filters.to);
    return { ok: true, data: rows.map(toListRow) };
  } catch (e) {
    return fail(e, 'Failed to export production orders.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

export async function getSabcrmSupplyProductionOrderKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmProductionOrderKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmProductionOrderDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const { items, hasMore } =
        await sabcrmSupplyProductionOrdersApi.listPaged(g.ctx.projectId, {
          page,
          limit: 100,
        });
      docs.push(...items);
      if (!hasMore) break;
      if (page === SCAN_MAX_PAGES) sampled = true;
    }

    const monthKey = new Date().toISOString().slice(0, 7);
    let plannedCount = 0;
    let inProgressCount = 0;
    let completedThisMonth = 0;
    let unitsYielded = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'planned') as SabcrmProductionOrderStatus;
      if (status === 'planned') plannedCount += 1;
      else if (status === 'in_progress') inProgressCount += 1;
      const isDone = status === 'completed' || doc.status === 'complete';
      if (
        isDone &&
        (doc.updatedAt ?? doc.plannedEnd ?? doc.createdAt ?? '').slice(0, 7) ===
          monthKey
      ) {
        completedThisMonth += 1;
      }
      if (isDone) unitsYielded += doc.actualYield ?? 0;
    }

    return {
      ok: true,
      data: {
        plannedCount,
        inProgressCount,
        completedThisMonth,
        unitsYielded: round2(unitsYielded),
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute production-order KPIs.');
  }
}

/* ─── Full-form create / update ────────────────────────────────── */

export async function createSabcrmSupplyProductionOrderFull(
  input: SabcrmProductionOrderFullInput,
  projectId?: string,
): Promise<ActionResult<CrmProductionOrderDoc>> {
  if (!input?.orderNo?.trim()) {
    return { ok: false, error: 'An order number is required.' };
  }
  if (!input.finishedGoodName?.trim()) {
    return { ok: false, error: 'A finished-good name is required.' };
  }
  const plannedQty = Number(input.plannedQty);
  if (!Number.isFinite(plannedQty) || plannedQty <= 0) {
    return { ok: false, error: 'The planned quantity must be greater than zero.' };
  }
  if (!input.unit?.trim()) {
    return { ok: false, error: 'A unit is required.' };
  }
  if (input.finishedGoodId && !ObjectId.isValid(input.finishedGoodId)) {
    return { ok: false, error: 'The finished good is invalid.' };
  }
  if (input.bomId && !ObjectId.isValid(input.bomId)) {
    return { ok: false, error: 'The linked BOM is invalid.' };
  }
  if (input.machineOperatorId && !ObjectId.isValid(input.machineOperatorId)) {
    return { ok: false, error: 'The machine operator is invalid.' };
  }
  const built = buildComponents(input.components ?? []);
  if ('error' in built) return { ok: false, error: built.error };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const wire: CrmProductionOrderCreateInput = {
      orderNo: input.orderNo.trim(),
      bomRef: input.bomRef?.trim() || undefined,
      bomId: input.bomId || undefined,
      finishedGoodId: input.finishedGoodId || undefined,
      finishedGoodName: input.finishedGoodName.trim(),
      plannedQty,
      unit: input.unit.trim(),
      plannedStart: input.plannedStart
        ? toIso(input.plannedStart) ?? undefined
        : undefined,
      plannedEnd: input.plannedEnd
        ? toIso(input.plannedEnd) ?? undefined
        : undefined,
      machineId: input.machineId?.trim() || undefined,
      machineOperator: input.machineOperator?.trim() || undefined,
      machineOperatorId: input.machineOperatorId || undefined,
      notes: input.notes?.trim() || undefined,
      components: built.components,
      labourCost: input.labourCost,
      overheadCost: input.overheadCost,
    };
    const created = await sabcrmSupplyProductionOrdersApi.create(
      g.ctx.projectId,
      wire,
    );
    // Fold the server-computed material/total cost in (the crate stores
    // both — keep the list/detail consistent with the editor preview).
    try {
      const totalCost = round2(
        built.materialCost + (input.labourCost ?? 0) + (input.overheadCost ?? 0),
      );
      const enriched = await sabcrmSupplyProductionOrdersApi.update(
        g.ctx.projectId,
        created._id,
        {
          materialCost: built.materialCost,
          totalCost,
        } as CrmProductionOrderUpdateInput,
      );
      revalidatePath(MO_PATH);
      return { ok: true, data: enriched };
    } catch {
      revalidatePath(MO_PATH);
      return { ok: true, data: created };
    }
  } catch (e) {
    return fail(e, 'Failed to create the production order.');
  }
}

export async function updateSabcrmSupplyProductionOrderFull(
  id: string,
  patch: SabcrmProductionOrderFullPatch,
  projectId?: string,
): Promise<ActionResult<CrmProductionOrderDoc>> {
  if (!id) return { ok: false, error: 'Production order id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: CrmProductionOrderUpdateInput = {};
  if (patch.finishedGoodName !== undefined) {
    if (!patch.finishedGoodName.trim()) {
      return { ok: false, error: 'A finished-good name is required.' };
    }
    wire.finishedGoodName = patch.finishedGoodName.trim();
  }
  if (patch.finishedGoodId !== undefined) {
    if (patch.finishedGoodId && !ObjectId.isValid(patch.finishedGoodId)) {
      return { ok: false, error: 'The finished good is invalid.' };
    }
    wire.finishedGoodId = patch.finishedGoodId || undefined;
  }
  if (patch.bomId !== undefined) {
    if (patch.bomId && !ObjectId.isValid(patch.bomId)) {
      return { ok: false, error: 'The linked BOM is invalid.' };
    }
    wire.bomId = patch.bomId || undefined;
  }
  if (patch.bomRef !== undefined) wire.bomRef = patch.bomRef || undefined;
  if (patch.plannedQty !== undefined) {
    const q = Number(patch.plannedQty);
    if (!Number.isFinite(q) || q <= 0) {
      return { ok: false, error: 'The planned quantity must be greater than zero.' };
    }
    wire.plannedQty = q;
  }
  if (patch.unit !== undefined) {
    if (!patch.unit.trim()) return { ok: false, error: 'A unit is required.' };
    wire.unit = patch.unit.trim();
  }
  if (patch.plannedStart !== undefined) {
    wire.plannedStart = patch.plannedStart
      ? toIso(patch.plannedStart) ?? undefined
      : undefined;
  }
  if (patch.plannedEnd !== undefined) {
    wire.plannedEnd = patch.plannedEnd
      ? toIso(patch.plannedEnd) ?? undefined
      : undefined;
  }
  if (patch.machineId !== undefined) wire.machineId = patch.machineId || undefined;
  if (patch.machineOperator !== undefined) {
    wire.machineOperator = patch.machineOperator || undefined;
  }
  if (patch.machineOperatorId !== undefined) {
    if (patch.machineOperatorId && !ObjectId.isValid(patch.machineOperatorId)) {
      return { ok: false, error: 'The machine operator is invalid.' };
    }
    wire.machineOperatorId = patch.machineOperatorId || undefined;
  }
  if (patch.notes !== undefined) wire.notes = patch.notes;
  if (patch.labourCost !== undefined) wire.labourCost = patch.labourCost;
  if (patch.overheadCost !== undefined) wire.overheadCost = patch.overheadCost;

  let materialCost: number | null = null;
  if (patch.components !== undefined) {
    const built = buildComponents(patch.components);
    if ('error' in built) return { ok: false, error: built.error };
    wire.components = built.components;
    materialCost = built.materialCost;
  }

  if (
    materialCost !== null ||
    patch.labourCost !== undefined ||
    patch.overheadCost !== undefined
  ) {
    try {
      const current = await sabcrmSupplyProductionOrdersApi.getById(
        g.ctx.projectId,
        id,
      );
      const baseMaterial =
        materialCost ??
        (current.components ?? []).reduce(
          (s, c) => s + (c.qty ?? 0) * (c.costPerUnit ?? 0),
          0,
        );
      wire.materialCost = round2(baseMaterial);
      wire.totalCost = round2(
        baseMaterial +
          (patch.labourCost ?? current.labourCost ?? 0) +
          (patch.overheadCost ?? current.overheadCost ?? 0),
      );
    } catch {
      /* skip rollup — list/detail recompute as a fallback */
    }
  }

  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmSupplyProductionOrdersApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(MO_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the production order.');
  }
}

/* ─── BOM prefill (Start production → order) ───────────────────── */

export async function getSabcrmSupplyProductionOrderBomPrefill(
  bomId: string,
  projectId?: string,
): Promise<ActionResult<SabcrmProductionOrderBomPrefill>> {
  if (!bomId || !ObjectId.isValid(bomId)) {
    return { ok: false, error: 'Invalid BOM.' };
  }
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const bom = await sabcrmSupplyBomApi.getById(g.ctx.projectId, bomId);
    return {
      ok: true,
      data: {
        bomId: bom._id,
        bomRef: bom.bomNo,
        finishedGoodId: bom.finishedGoodId ?? null,
        finishedGoodName: bom.finishedGoodName,
        unit: bom.unit ?? 'unit',
        outputQty: bom.outputQty ?? 1,
        labourCost: bom.labourCost,
        overheadCost: bom.overheadCost,
        components: (bom.components ?? []).map((c) => ({
          itemId: c.itemId,
          itemName: c.itemName,
          qty: c.qty,
          unit: c.unit,
          scrapPct: c.scrapPct,
          costPerUnit: c.costPerUnit,
        })),
      },
    };
  } catch (e) {
    return fail(e, 'Failed to prefill from the BOM.');
  }
}
