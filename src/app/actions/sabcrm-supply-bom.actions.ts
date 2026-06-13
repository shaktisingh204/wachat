'use server';

/**
 * SabCRM Supply — BOM (bill of materials) surface server actions
 * (rollout WI-10).
 *
 * The doc-surface-kit data paths for `/sabcrm/supply/bom`:
 *
 *   - paged list rows (component counts + server-rolled total cost);
 *   - KPI strip (active / draft / obsolete / average cost);
 *   - capped fetch-all for CSV export;
 *   - full-form create/update with a server-computed `totalCost`
 *     (Σ component qty×costPerUnit + labour + overhead) so the list and
 *     detail never disagree with the editor preview.
 *
 * Get + status transitions live in the shared module
 * (`sabcrm-supply-docs.actions.ts`). The crate is crm-common style and
 * stores free-form status — the UI vocab is the only guard.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmSupplyBomApi,
  type CrmBomDoc,
} from '@/lib/rust-client/sabcrm-supply';
import type {
  CrmBomComponent,
  CrmBomCreateInput,
  CrmBomUpdateInput,
} from '@/lib/rust-client/crm-bom';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { SabcrmBomStatus } from './sabcrm-supply-docs.actions.types';
import type {
  SabcrmBomComponentInput,
  SabcrmBomFullInput,
  SabcrmBomFullPatch,
  SabcrmBomKpis,
  SabcrmBomListFilters,
  SabcrmBomListPage,
  SabcrmBomListRow,
} from './sabcrm-supply-bom.actions.types';

/* ─── Gate ─────────────────────────────────────────────────────── */

const MODULE_KEY = 'sabcrm';
const BOM_PATH = '/sabcrm/supply/bom';

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

/* ─── Cost rollup + wire mapping ───────────────────────────────── */

/**
 * Normalises one component draft → wire `CrmBomComponent`. Free-text
 * components are allowed (no itemId), but a name is always required.
 */
function toWireComponent(c: SabcrmBomComponentInput): CrmBomComponent | string {
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
    optional: c.optional ? true : undefined,
    costPerUnit:
      Number.isFinite(c.costPerUnit) && (c.costPerUnit ?? 0) > 0
        ? Number(c.costPerUnit)
        : undefined,
  };
}

function buildComponents(
  components: SabcrmBomComponentInput[],
): { components: CrmBomComponent[]; materialCost: number } | { error: string } {
  const meaningful = (components ?? []).filter((c) => (c.itemName ?? '').trim());
  if (meaningful.length === 0) {
    return { error: 'Add at least one component.' };
  }
  const out: CrmBomComponent[] = [];
  let materialCost = 0;
  for (const c of meaningful) {
    const wire = toWireComponent(c);
    if (typeof wire === 'string') return { error: wire };
    out.push(wire);
    materialCost += (wire.qty ?? 0) * (wire.costPerUnit ?? 0);
  }
  return { components: out, materialCost: round2(materialCost) };
}

function rolledTotal(
  materialCost: number,
  labourCost?: number,
  overheadCost?: number,
): number {
  return round2(materialCost + (labourCost ?? 0) + (overheadCost ?? 0));
}

/* ─── List page ────────────────────────────────────────────────── */

function bomTotalCost(doc: CrmBomDoc): number {
  if (typeof doc.totalCost === 'number' && doc.totalCost > 0) {
    return doc.totalCost;
  }
  const material = (doc.components ?? []).reduce(
    (s, c) => s + (c.qty ?? 0) * (c.costPerUnit ?? 0),
    0,
  );
  return round2(material + (doc.labourCost ?? 0) + (doc.overheadCost ?? 0));
}

function toListRow(doc: CrmBomDoc): SabcrmBomListRow {
  return {
    id: doc._id,
    bomNo: doc.bomNo,
    finishedGoodName: doc.finishedGoodName,
    outputQty: doc.outputQty ?? 0,
    unit: doc.unit ?? '',
    componentCount: doc.components?.length ?? 0,
    version: doc.version ?? '1',
    totalCost: bomTotalCost(doc),
    status: (doc.status ?? 'draft') as SabcrmBomStatus,
  };
}

function applyDateRange(
  docs: CrmBomDoc[],
  from?: string,
  to?: string,
): CrmBomDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.effectiveDate ?? d.createdAt ?? '').slice(0, 10);
    return !day || (day >= fromKey && day <= toKey);
  });
}

export async function listSabcrmSupplyBomsPage(
  filters: SabcrmBomListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmBomListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const { items, hasMore } = await sabcrmSupplyBomApi.listPaged(
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
    return fail(e, 'Failed to list bills of material.');
  }
}

const SCAN_MAX_PAGES = 5;

export async function exportSabcrmSupplyBomRows(
  filters: SabcrmBomListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmBomListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmBomDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const { items, hasMore } = await sabcrmSupplyBomApi.listPaged(
        g.ctx.projectId,
        {
          page,
          limit: 100,
          q: filters.q || undefined,
          status: filters.status || undefined,
        },
      );
      docs.push(...items);
      if (!hasMore) break;
    }
    const rows = applyDateRange(docs, filters.from, filters.to);
    return { ok: true, data: rows.map(toListRow) };
  } catch (e) {
    return fail(e, 'Failed to export bills of material.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

export async function getSabcrmSupplyBomKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmBomKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmBomDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const { items, hasMore } = await sabcrmSupplyBomApi.listPaged(
        g.ctx.projectId,
        { page, limit: 100 },
      );
      docs.push(...items);
      if (!hasMore) break;
      if (page === SCAN_MAX_PAGES) sampled = true;
    }

    let activeCount = 0;
    let draftCount = 0;
    let obsoleteCount = 0;
    let costSum = 0;
    let costCount = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'draft') as SabcrmBomStatus;
      if (status === 'active') activeCount += 1;
      else if (status === 'obsolete') obsoleteCount += 1;
      else draftCount += 1;
      const cost = bomTotalCost(doc);
      if (cost > 0) {
        costSum += cost;
        costCount += 1;
      }
    }

    return {
      ok: true,
      data: {
        activeCount,
        draftCount,
        obsoleteCount,
        avgCost: costCount > 0 ? round2(costSum / costCount) : 0,
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute BOM KPIs.');
  }
}

/* ─── Full-form create / update ────────────────────────────────── */

function toIso(raw: string): string | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function createSabcrmSupplyBomFull(
  input: SabcrmBomFullInput,
  projectId?: string,
): Promise<ActionResult<CrmBomDoc>> {
  if (!input?.bomNo?.trim()) {
    return { ok: false, error: 'A BOM number is required.' };
  }
  if (!input.finishedGoodName?.trim()) {
    return { ok: false, error: 'A finished-good name is required.' };
  }
  const outputQty = Number(input.outputQty);
  if (!Number.isFinite(outputQty) || outputQty <= 0) {
    return { ok: false, error: 'The output quantity must be greater than zero.' };
  }
  if (!input.unit?.trim()) {
    return { ok: false, error: 'A unit is required.' };
  }
  if (input.finishedGoodId && !ObjectId.isValid(input.finishedGoodId)) {
    return { ok: false, error: 'The finished good is invalid.' };
  }
  const built = buildComponents(input.components ?? []);
  if ('error' in built) return { ok: false, error: built.error };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const wire: CrmBomCreateInput = {
      bomNo: input.bomNo.trim(),
      finishedGoodName: input.finishedGoodName.trim(),
      finishedGoodId: input.finishedGoodId || undefined,
      outputQty,
      unit: input.unit.trim(),
      effectiveDate: input.effectiveDate
        ? toIso(input.effectiveDate) ?? undefined
        : undefined,
      version: input.version?.trim() || '1',
      notes: input.notes?.trim() || undefined,
      components: built.components,
      labourCost: input.labourCost,
      overheadCost: input.overheadCost,
      totalCost: rolledTotal(
        built.materialCost,
        input.labourCost,
        input.overheadCost,
      ),
    };
    const created = await sabcrmSupplyBomApi.create(g.ctx.projectId, wire);
    revalidatePath(BOM_PATH);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create the bill of materials.');
  }
}

export async function updateSabcrmSupplyBomFull(
  id: string,
  patch: SabcrmBomFullPatch,
  projectId?: string,
): Promise<ActionResult<CrmBomDoc>> {
  if (!id) return { ok: false, error: 'BOM id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: CrmBomUpdateInput = {};
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
  if (patch.outputQty !== undefined) {
    const q = Number(patch.outputQty);
    if (!Number.isFinite(q) || q <= 0) {
      return { ok: false, error: 'The output quantity must be greater than zero.' };
    }
    wire.outputQty = q;
  }
  if (patch.unit !== undefined) {
    if (!patch.unit.trim()) return { ok: false, error: 'A unit is required.' };
    wire.unit = patch.unit.trim();
  }
  if (patch.effectiveDate !== undefined) {
    wire.effectiveDate = patch.effectiveDate
      ? toIso(patch.effectiveDate) ?? undefined
      : undefined;
  }
  if (patch.version !== undefined) wire.version = patch.version.trim() || '1';
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

  // Recompute totalCost whenever components or cost inputs changed.
  if (
    materialCost !== null ||
    patch.labourCost !== undefined ||
    patch.overheadCost !== undefined
  ) {
    try {
      const current = await sabcrmSupplyBomApi.getById(g.ctx.projectId, id);
      const baseMaterial =
        materialCost ??
        (current.components ?? []).reduce(
          (s, c) => s + (c.qty ?? 0) * (c.costPerUnit ?? 0),
          0,
        );
      wire.totalCost = rolledTotal(
        round2(baseMaterial),
        patch.labourCost ?? current.labourCost,
        patch.overheadCost ?? current.overheadCost,
      );
    } catch {
      // Couldn't read the current doc — skip the rollup; the list/detail
      // recompute from components as a fallback.
    }
  }

  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmSupplyBomApi.update(g.ctx.projectId, id, wire);
    revalidatePath(BOM_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the bill of materials.');
  }
}
