'use server';

/**
 * SabCRM Supply — GRN (goods-receipt note) surface server actions
 * (rollout WI-6).
 *
 * The doc-surface-kit data paths for `/sabcrm/supply/grn`, mirroring the
 * PO module:
 *
 *   - paged display-ready list rows (vendor / warehouse / PO labels
 *     batch-resolved — no N+1, no raw ObjectIds reach the client).
 *     Pagination goes through `listPaged` on the supply client (the
 *     SINGLE 0-indexed vs 1-indexed envelope normalizer);
 *   - KPI strip (awaiting inspection, posted this month, rejected, units
 *     accepted) over a capped scan;
 *   - capped fetch-all for CSV export;
 *   - full-form create/update (real GrnLineItem quartets, SabFiles
 *     attachments — `receivedQty == acceptedQty + rejectedQty` enforced
 *     here);
 *   - resolved detail lines (item labels) for the [id] quartet rail.
 *
 * Get + status transitions live in the shared module
 * (`sabcrm-supply-docs.actions.ts`) and are not duplicated here.
 *
 * Every action re-runs the session → project → RBAC → plan gate. The
 * Rust engine may be down at dev time — failures normalise into
 * `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmSupplyGrnsApi,
  sabcrmSupplyVendorsApi,
  sabcrmSupplyWarehousesApi,
  sabcrmSupplyPurchaseOrdersApi,
  sabcrmSupplyItemsApi,
  type CrmGrnDoc,
} from '@/lib/rust-client/sabcrm-supply';
import type {
  CrmGrnCreateInput,
  CrmGrnLineItem,
  CrmGrnUpdateInput,
} from '@/lib/rust-client/crm-grns';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { SabcrmGrnStatus } from './sabcrm-supply-docs.actions.types';
import type {
  SabcrmGrnDetailLine,
  SabcrmGrnFullInput,
  SabcrmGrnFullPatch,
  SabcrmGrnKpis,
  SabcrmGrnLineInput,
  SabcrmGrnListFilters,
  SabcrmGrnListPage,
  SabcrmGrnListRow,
} from './sabcrm-supply-grn.actions.types';

/* ─── Gate (mirrors sabcrm-supply-docs.actions.ts verbatim) ────── */

const MODULE_KEY = 'sabcrm';
const GRN_PATH = '/sabcrm/supply/grn';

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

function toIso(raw: string): string | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ─── Wire mapping ─────────────────────────────────────────────── */

/** Normalises one received-line draft → wire `GrnLineItem` (validated). */
function toWireLine(line: SabcrmGrnLineInput): CrmGrnLineItem | string {
  if (!line.itemId || !ObjectId.isValid(line.itemId)) {
    return 'Each received line needs a real catalog item.';
  }
  const ordered = Math.max(0, Number(line.orderedQty) || 0);
  const received = Math.max(0, Number(line.receivedQty) || 0);
  const accepted = Math.max(0, Number(line.acceptedQty) || 0);
  const rejected = Math.max(0, Number(line.rejectedQty) || 0);
  if (accepted + rejected > received + 1e-6) {
    return 'Accepted + rejected cannot exceed the received quantity.';
  }
  const serials = (line.serialNos ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    itemId: line.itemId,
    orderedQty: ordered,
    receivedQty: received,
    acceptedQty: accepted,
    rejectedQty: rejected,
    batch: line.batch?.trim() || undefined,
    expiry: line.expiry ? toIso(line.expiry) ?? undefined : undefined,
    serialNos: serials.length > 0 ? serials : undefined,
  };
}

function buildWireLines(
  lines: SabcrmGrnLineInput[],
): { items: CrmGrnLineItem[] } | { error: string } {
  const meaningful = lines.filter(
    (l) => l.itemId && (l.receivedQty > 0 || l.orderedQty > 0),
  );
  if (meaningful.length === 0) {
    return { error: 'Add at least one received line.' };
  }
  const items: CrmGrnLineItem[] = [];
  for (const line of meaningful) {
    const wire = toWireLine(line);
    if (typeof wire === 'string') return { error: wire };
    items.push(wire);
  }
  return { items };
}

/* ─── Label resolution (batch — no N+1) ────────────────────────── */

async function resolveLabelMaps(
  docs: CrmGrnDoc[],
  projectId: string,
): Promise<{
  vendors: Map<string, string>;
  warehouses: Map<string, string>;
  pos: Map<string, string>;
}> {
  const vendorIds = [...new Set(docs.map((d) => d.vendorId).filter(Boolean))];
  const warehouseIds = [
    ...new Set(docs.map((d) => d.warehouseId).filter(Boolean)),
  ];
  const poIds = [
    ...new Set(docs.map((d) => d.poId).filter(Boolean)),
  ] as string[];

  const vendors = new Map<string, string>();
  const warehouses = new Map<string, string>();
  const pos = new Map<string, string>();

  await Promise.all([
    ...vendorIds.map(async (id) => {
      try {
        const v = await sabcrmSupplyVendorsApi.getById(projectId, id);
        vendors.set(id, v.displayName || v.name || 'Unnamed vendor');
      } catch {
        /* gone — muted fallback */
      }
    }),
    ...warehouseIds.map(async (id) => {
      try {
        const w = await sabcrmSupplyWarehousesApi.getById(projectId, id);
        warehouses.set(id, w.name || 'Unnamed warehouse');
      } catch {
        /* gone */
      }
    }),
    ...poIds.map(async (id) => {
      try {
        const p = await sabcrmSupplyPurchaseOrdersApi.getById(projectId, id);
        pos.set(id, p.poNo || 'PO');
      } catch {
        /* gone */
      }
    }),
  ]);

  return { vendors, warehouses, pos };
}

function toListRow(
  doc: CrmGrnDoc,
  vendors: Map<string, string>,
  warehouses: Map<string, string>,
  pos: Map<string, string>,
): SabcrmGrnListRow {
  const items = doc.items ?? [];
  const acceptedQty = items.reduce((s, it) => s + (it.acceptedQty ?? 0), 0);
  const receivedQty = items.reduce((s, it) => s + (it.receivedQty ?? 0), 0);
  return {
    id: doc._id,
    grnNo: doc.grnNo,
    vendorId: doc.vendorId ?? '',
    vendorLabel: doc.vendorId ? (vendors.get(doc.vendorId) ?? null) : null,
    warehouseId: doc.warehouseId ?? '',
    warehouseLabel: doc.warehouseId
      ? (warehouses.get(doc.warehouseId) ?? null)
      : null,
    poId: doc.poId ?? null,
    poLabel: doc.poId ? (pos.get(doc.poId) ?? null) : null,
    date: doc.date,
    acceptedQty,
    receivedQty,
    lineCount: items.length,
    status: (doc.status ?? 'draft') as SabcrmGrnStatus,
  };
}

function applyDateRange(
  docs: CrmGrnDoc[],
  from?: string,
  to?: string,
): CrmGrnDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.date ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

/* ─── List page ────────────────────────────────────────────────── */

export async function listSabcrmSupplyGrnsPage(
  filters: SabcrmGrnListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmGrnListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const { items, hasMore } = await sabcrmSupplyGrnsApi.listPaged(
      g.ctx.projectId,
      {
        page,
        limit,
        q: filters.q || undefined,
        vendorId: filters.vendorId || undefined,
        status: filters.status || undefined,
      },
    );
    const pageDocs = applyDateRange(items, filters.from, filters.to);
    const maps = await resolveLabelMaps(pageDocs, g.ctx.projectId);
    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) =>
          toListRow(d, maps.vendors, maps.warehouses, maps.pos),
        ),
        page,
        hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list goods receipts.');
  }
}

const SCAN_MAX_PAGES = 5;

export async function exportSabcrmSupplyGrnRows(
  filters: SabcrmGrnListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmGrnListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmGrnDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const { items, hasMore } = await sabcrmSupplyGrnsApi.listPaged(
        g.ctx.projectId,
        {
          page,
          limit: 100,
          q: filters.q || undefined,
          vendorId: filters.vendorId || undefined,
          status: filters.status || undefined,
        },
      );
      docs.push(...items);
      if (!hasMore) break;
    }
    const rows = applyDateRange(docs, filters.from, filters.to);
    const maps = await resolveLabelMaps(rows, g.ctx.projectId);
    return {
      ok: true,
      data: rows.map((d) =>
        toListRow(d, maps.vendors, maps.warehouses, maps.pos),
      ),
    };
  } catch (e) {
    return fail(e, 'Failed to export goods receipts.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

const AWAITING_INSPECTION = new Set<SabcrmGrnStatus>([
  'draft',
  'received',
  'partial',
]);

export async function getSabcrmSupplyGrnKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmGrnKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmGrnDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const { items, hasMore } = await sabcrmSupplyGrnsApi.listPaged(
        g.ctx.projectId,
        { page, limit: 100 },
      );
      docs.push(...items);
      if (!hasMore) break;
      if (page === SCAN_MAX_PAGES) sampled = true;
    }

    const monthKey = todayKey().slice(0, 7);
    let awaitingInspectionCount = 0;
    let postedThisMonth = 0;
    let rejectedCount = 0;
    let unitsAccepted = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'draft') as SabcrmGrnStatus;
      if (AWAITING_INSPECTION.has(status)) awaitingInspectionCount += 1;
      if (status === 'qc_failed' || status === 'rejected') rejectedCount += 1;
      if (
        (status === 'posted' || status === 'closed') &&
        (doc.audit?.updatedAt ?? doc.updatedAt ?? doc.date ?? '').slice(0, 7) ===
          monthKey
      ) {
        postedThisMonth += 1;
      }
      unitsAccepted += (doc.items ?? []).reduce(
        (s, it) => s + (it.acceptedQty ?? 0),
        0,
      );
    }

    return {
      ok: true,
      data: {
        awaitingInspectionCount,
        postedThisMonth,
        rejectedCount,
        unitsAccepted: Math.round(unitsAccepted * 100) / 100,
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute GRN KPIs.');
  }
}

/* ─── Full-form create / update ────────────────────────────────── */

export async function createSabcrmSupplyGrnFull(
  input: SabcrmGrnFullInput,
  projectId?: string,
): Promise<ActionResult<CrmGrnDoc>> {
  if (!input?.grnNo?.trim()) {
    return { ok: false, error: 'A GRN number is required.' };
  }
  if (!input.vendorId || !ObjectId.isValid(input.vendorId)) {
    return { ok: false, error: 'Pick a vendor for this goods receipt.' };
  }
  if (!input.warehouseId || !ObjectId.isValid(input.warehouseId)) {
    return { ok: false, error: 'Pick the receiving warehouse.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid receipt date is required.' };
  if (input.poId && !ObjectId.isValid(input.poId)) {
    return { ok: false, error: 'The linked purchase order is invalid.' };
  }
  if (input.inspectorId && !ObjectId.isValid(input.inspectorId)) {
    return { ok: false, error: 'The inspector is invalid.' };
  }
  const built = buildWireLines(input.items ?? []);
  if ('error' in built) return { ok: false, error: built.error };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const wire: CrmGrnCreateInput = {
      grnNo: input.grnNo.trim(),
      date: dateIso,
      poId: input.poId || undefined,
      vendorId: input.vendorId,
      warehouseId: input.warehouseId,
      items: built.items,
      inspectorId: input.inspectorId || undefined,
      attachments: (input.attachments ?? []).map((a) => ({
        url: a.fileId,
        name: a.name,
        mimeType: a.mimeType,
        size: a.size,
      })),
    };
    const created = await sabcrmSupplyGrnsApi.create(g.ctx.projectId, wire);
    revalidatePath(GRN_PATH);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create the goods receipt.');
  }
}

export async function updateSabcrmSupplyGrnFull(
  id: string,
  patch: SabcrmGrnFullPatch,
  projectId?: string,
): Promise<ActionResult<CrmGrnDoc>> {
  if (!id) return { ok: false, error: 'GRN id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: CrmGrnUpdateInput = {};
  if (patch.vendorId !== undefined) {
    if (!patch.vendorId || !ObjectId.isValid(patch.vendorId)) {
      return { ok: false, error: 'Pick a vendor for this goods receipt.' };
    }
    wire.vendorId = patch.vendorId;
  }
  if (patch.warehouseId !== undefined) {
    if (!patch.warehouseId || !ObjectId.isValid(patch.warehouseId)) {
      return { ok: false, error: 'Pick the receiving warehouse.' };
    }
    wire.warehouseId = patch.warehouseId;
  }
  if (patch.date !== undefined) {
    const iso = toIso(patch.date);
    if (!iso) return { ok: false, error: 'The receipt date is invalid.' };
    wire.date = iso;
  }
  if (patch.inspectorId !== undefined) {
    if (patch.inspectorId && !ObjectId.isValid(patch.inspectorId)) {
      return { ok: false, error: 'The inspector is invalid.' };
    }
    wire.inspectorId = patch.inspectorId || undefined;
  }
  if (patch.items !== undefined) {
    const built = buildWireLines(patch.items);
    if ('error' in built) return { ok: false, error: built.error };
    wire.items = built.items;
  }
  if (patch.attachments !== undefined) {
    wire.attachments = patch.attachments.map((a) => ({
      url: a.fileId,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
    }));
  }
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmSupplyGrnsApi.update(g.ctx.projectId, id, wire);
    revalidatePath(GRN_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the goods receipt.');
  }
}

/* ─── Detail line resolution (quartet rail) ────────────────────── */

/**
 * Resolves a GRN's received lines to display-ready rows (item labels
 * batch-resolved) for the [id] detail's ordered/received/accepted/
 * rejected quartet table.
 */
export async function getSabcrmSupplyGrnDetailLines(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmGrnDetailLine[]>> {
  if (!id) return { ok: false, error: 'GRN id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmSupplyGrnsApi.getById(g.ctx.projectId, id);
    const ids = [
      ...new Set((doc.items ?? []).map((it) => it.itemId).filter(Boolean)),
    ];
    const labels = new Map<string, string>();
    await Promise.all(
      ids.map(async (itemId) => {
        try {
          const item = await sabcrmSupplyItemsApi.getById(
            g.ctx.projectId,
            itemId,
          );
          labels.set(
            itemId,
            item.name || item.sku || 'Catalog item',
          );
        } catch {
          /* gone */
        }
      }),
    );
    return {
      ok: true,
      data: (doc.items ?? []).map((it) => ({
        ...it,
        itemLabel: it.itemId ? (labels.get(it.itemId) ?? null) : null,
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to resolve the goods-receipt lines.');
  }
}

/* ─── PO prefill (Receive → GRN convert) ───────────────────────── */

/**
 * Builds a GRN-form prefill from a purchase order (the PO detail's
 * "Receive → GRN" convert routes to `?fromPo=<id>`; the GRN page resolves
 * it server-side). Vendor + ship-to warehouse + per-item ordered
 * quantities seed the bespoke lines editor.
 */
export async function getSabcrmSupplyGrnPrefillFromPo(
  poId: string,
  projectId?: string,
): Promise<
  ActionResult<{
    vendorId: string;
    vendorLabel: string | null;
    warehouseId: string | null;
    warehouseLabel: string | null;
    poId: string;
    poLabel: string;
    lines: {
      itemId: string;
      itemLabel: string | null;
      orderedQty: number;
    }[];
  }>
> {
  if (!poId || !ObjectId.isValid(poId)) {
    return { ok: false, error: 'Invalid purchase order.' };
  }
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const po = await sabcrmSupplyPurchaseOrdersApi.getById(g.ctx.projectId, poId);
    let vendorLabel: string | null = null;
    if (po.vendorId) {
      try {
        const v = await sabcrmSupplyVendorsApi.getById(
          g.ctx.projectId,
          po.vendorId,
        );
        vendorLabel = v.displayName || v.name || null;
      } catch {
        /* gone */
      }
    }
    let warehouseLabel: string | null = null;
    if (po.shipToWarehouseId) {
      try {
        const w = await sabcrmSupplyWarehousesApi.getById(
          g.ctx.projectId,
          po.shipToWarehouseId,
        );
        warehouseLabel = w.name || null;
      } catch {
        /* gone */
      }
    }

    const itemIds = [
      ...new Set((po.items ?? []).map((it) => it.itemId).filter(Boolean)),
    ] as string[];
    const itemLabels = new Map<string, string>();
    await Promise.all(
      itemIds.map(async (itemId) => {
        try {
          const item = await sabcrmSupplyItemsApi.getById(
            g.ctx.projectId,
            itemId,
          );
          itemLabels.set(itemId, item.name || item.sku || 'Catalog item');
        } catch {
          /* gone */
        }
      }),
    );

    return {
      ok: true,
      data: {
        vendorId: po.vendorId ?? '',
        vendorLabel,
        warehouseId: po.shipToWarehouseId ?? null,
        warehouseLabel,
        poId: po._id,
        poLabel: po.poNo,
        lines: (po.items ?? [])
          .filter((it) => it.itemId)
          .map((it) => ({
            itemId: it.itemId as string,
            itemLabel: it.itemId ? (itemLabels.get(it.itemId) ?? null) : null,
            orderedQty: it.qty ?? 0,
          })),
      },
    };
  } catch (e) {
    return fail(e, 'Failed to prefill from the purchase order.');
  }
}
