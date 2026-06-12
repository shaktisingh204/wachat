'use server';

/**
 * SabCRM Finance — recurring-invoice surface server actions.
 *
 * Full doc-surface adoption for `/sabcrm/finance/recurring-invoices`
 * (finance-rollout spec §3.11): paged display-ready rows (customer
 * labels batch-resolved through the records engine, template invoices
 * resolved per unique id — never N+1 per row), KPI strip (active
 * schedules, runs due in 7 days, paused, lifetime runs), capped CSV
 * export, full-field create/update (REAL picked customerId — the
 * placeholder-id minting of the old minimal dialog is gone) and the
 * pause / resume / stop transitions.
 *
 * Rust wire traps honoured here: crm-common-style crate — 0-INDEXED
 * list pages returning `{ items, page, limit, hasMore }`, create
 * `{ id, entity }`, delete = archive. The kit's 1-indexed page is
 * translated at the wire boundary.
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * its siblings; engine failures normalise into `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmFinanceApi,
  sabcrmFinanceRecurringInvoicesApi,
  type SabcrmRecurringInvoiceDoc,
  type SabcrmRecurringInvoiceUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type {
  CrmRecurringInvoiceFrequency,
  CrmRecurringInvoiceStatus,
} from '@/lib/rust-client/crm-recurring-invoices';
import type { ActionResult } from '@/lib/sabcrm/types';
import { resolveSabcrmFinanceParties } from './sabcrm-finance-invoices.actions';
import type { SabcrmPartyRef } from './sabcrm-finance-invoices.actions.types';
import {
  SABCRM_RECURRING_TRANSITIONS,
  type SabcrmRecurringInvoiceFullInput,
  type SabcrmRecurringInvoiceFullPatch,
  type SabcrmRecurringInvoiceKpis,
  type SabcrmRecurringInvoiceListFilters,
  type SabcrmRecurringInvoiceListPage,
  type SabcrmRecurringInvoiceListRow,
} from './sabcrm-finance-recurring-invoices.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const RECURRING_PATH = '/sabcrm/finance/recurring-invoices';

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

/** Coerce a `YYYY-MM-DD` / ISO date string into a full RFC3339 instant. */
function toIso(raw: string): string | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ─── Vocabulary ───────────────────────────────────────────────── */

const FREQUENCIES: ReadonlySet<CrmRecurringInvoiceFrequency> = new Set([
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
]);

const RECURRING_STATUSES: ReadonlySet<CrmRecurringInvoiceStatus> = new Set([
  'active',
  'paused',
  'stopped',
  'completed',
  'archived',
]);

/* ─── Row shaping (batched lookups) ────────────────────────────── */

/** Resolve template-invoice numbers — one getInvoice per UNIQUE id. */
async function templateLabelMap(
  ids: string[],
  projectId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter((id) => ObjectId.isValid(id)))].slice(
    0,
    100,
  );
  await Promise.all(
    unique.map(async (id) => {
      try {
        const doc = await sabcrmFinanceApi.getInvoice(projectId, id);
        map.set(id, doc.invoiceNo);
      } catch {
        // Template invoice gone — render the muted fallback.
      }
    }),
  );
  return map;
}

function toListRow(
  doc: SabcrmRecurringInvoiceDoc,
  parties: Map<string, SabcrmPartyRef>,
  templates: Map<string, string>,
): SabcrmRecurringInvoiceListRow {
  const party = doc.customerId ? parties.get(doc.customerId) : undefined;
  return {
    id: doc._id,
    title: doc.title ?? '',
    customerId: doc.customerId ?? '',
    customerLabel: party?.label ?? null,
    customerObjectSlug: party?.objectSlug ?? null,
    invoiceTemplateId: doc.invoiceTemplateId ?? null,
    invoiceTemplateLabel: doc.invoiceTemplateId
      ? (templates.get(doc.invoiceTemplateId) ?? null)
      : null,
    frequency: doc.frequency ?? 'monthly',
    startDate: doc.startDate ?? '',
    endDate: doc.endDate ?? '',
    nextRunAt: doc.nextRunAt ?? '',
    lastRunAt: doc.lastRunAt ?? '',
    totalRuns: doc.totalRuns ?? 0,
    status: (doc.status ?? 'active') as CrmRecurringInvoiceStatus,
    notes: doc.notes ?? '',
  };
}

async function shapeRows(
  docs: SabcrmRecurringInvoiceDoc[],
  projectId: string,
): Promise<SabcrmRecurringInvoiceListRow[]> {
  const partyIds = docs.map((d) => d.customerId ?? '').filter(Boolean);
  const parties = new Map<string, SabcrmPartyRef>();
  if (partyIds.length > 0) {
    const refs = await resolveSabcrmFinanceParties(partyIds, projectId);
    if (refs.ok) for (const ref of refs.data) parties.set(ref.id, ref);
  }
  const templates = await templateLabelMap(
    docs.map((d) => d.invoiceTemplateId ?? '').filter(Boolean),
    projectId,
  );
  return docs.map((d) => toListRow(d, parties, templates));
}

/** In-page inclusive date refinement on the schedule start date. */
function refineByStartDate(
  docs: SabcrmRecurringInvoiceDoc[],
  from?: string,
  to?: string,
): SabcrmRecurringInvoiceDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.startDate ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

/* ─── List page ────────────────────────────────────────────────── */

/**
 * Lists a page of display-ready schedule rows. NB the crm-common crates
 * paginate 0-INDEXED — the kit's 1-indexed page translates here. An
 * empty status filter maps to the crate's default (archived hidden).
 */
export async function listSabcrmRecurringInvoicesPage(
  filters: SabcrmRecurringInvoiceListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmRecurringInvoiceListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmFinanceRecurringInvoicesApi.list(g.ctx.projectId, {
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
    });
    const pageDocs = refineByStartDate(res.items, filters.from, filters.to);
    const rows = await shapeRows(pageDocs, g.ctx.projectId);
    return { ok: true, data: { rows, page, hasMore: res.hasMore } };
  } catch (e) {
    return fail(e, 'Failed to list recurring invoices.');
  }
}

/** 0-indexed pages scanned for export/KPIs (100 docs each). */
const SCAN_MAX_PAGES = 5;

/** Fetch-all (capped at 500) for CSV export, honouring current filters. */
export async function exportSabcrmRecurringInvoiceRows(
  filters: SabcrmRecurringInvoiceListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmRecurringInvoiceListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmRecurringInvoiceDoc[] = [];
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinanceRecurringInvoicesApi.list(
        g.ctx.projectId,
        {
          page,
          limit: 100,
          q: filters.q || undefined,
          status: filters.status || undefined,
        },
      );
      docs.push(...res.items);
      if (!res.hasMore) break;
    }
    const rows = await shapeRows(
      refineByStartDate(docs, filters.from, filters.to),
      g.ctx.projectId,
    );
    return { ok: true, data: rows };
  } catch (e) {
    return fail(e, 'Failed to export recurring invoices.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/**
 * KPI strip over a capped scan (up to 500 schedules): active count,
 * runs due in the next 7 days, paused count, lifetime generated runs.
 */
export async function getSabcrmRecurringInvoiceKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmRecurringInvoiceKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmRecurringInvoiceDoc[] = [];
    let sampled = false;
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinanceRecurringInvoicesApi.list(
        g.ctx.projectId,
        { page, limit: 100 },
      );
      docs.push(...res.items);
      if (!res.hasMore) break;
      if (page === SCAN_MAX_PAGES - 1) sampled = true;
    }

    const now = Date.now();
    const in7Days = now + 7 * 86_400_000;
    let activeCount = 0;
    let dueIn7Days = 0;
    let pausedCount = 0;
    let lifetimeRuns = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'active') as CrmRecurringInvoiceStatus;
      lifetimeRuns += doc.totalRuns ?? 0;
      if (status === 'paused') pausedCount += 1;
      if (status !== 'active') continue;
      activeCount += 1;
      if (doc.nextRunAt) {
        const next = new Date(doc.nextRunAt).getTime();
        if (Number.isFinite(next) && next >= now - 86_400_000 && next <= in7Days) {
          dueIn7Days += 1;
        }
      }
    }

    return {
      ok: true,
      data: {
        activeCount,
        dueIn7Days,
        pausedCount,
        lifetimeRuns,
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute recurring-invoice KPIs.');
  }
}

/* ─── Create / update (full dialog) ────────────────────────────── */

/**
 * Creates a schedule from the full dialog. `customerId` is a REAL
 * picked records-engine record — required and validated (the old
 * surface's placeholder-id minting is gone, per the spec).
 */
export async function createSabcrmRecurringInvoiceFull(
  input: SabcrmRecurringInvoiceFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRecurringInvoiceDoc>> {
  if (!input?.customerId || !ObjectId.isValid(input.customerId)) {
    return { ok: false, error: 'Pick a customer for this schedule.' };
  }
  if (!FREQUENCIES.has(input.frequency)) {
    return { ok: false, error: 'Pick a valid frequency.' };
  }
  const startIso = input.startDate ? toIso(input.startDate) : null;
  if (!startIso) return { ok: false, error: 'A valid start date is required.' };
  let endIso: string | undefined;
  if (input.endDate) {
    const iso = toIso(input.endDate);
    if (!iso) return { ok: false, error: 'The end date is invalid.' };
    if (input.endDate < input.startDate) {
      return { ok: false, error: "The end date can't be before the start date." };
    }
    endIso = iso;
  }
  if (input.status !== undefined && !RECURRING_STATUSES.has(input.status)) {
    return { ok: false, error: 'Pick a valid schedule status.' };
  }
  if (input.invoiceTemplateId && !ObjectId.isValid(input.invoiceTemplateId)) {
    return { ok: false, error: 'The invoice-to-clone reference is invalid.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmFinanceRecurringInvoicesApi.create(
      g.ctx.projectId,
      {
        title: input.title?.trim() || undefined,
        invoiceTemplateId: input.invoiceTemplateId || undefined,
        customerId: input.customerId,
        frequency: input.frequency,
        startDate: startIso,
        endDate: endIso,
        status: input.status,
        notes: input.notes?.trim() || undefined,
      },
    );
    revalidatePath(RECURRING_PATH);
    return { ok: true, data: res.entity };
  } catch (e) {
    return fail(e, 'Failed to create the recurring invoice.');
  }
}

/** Full-field patch (title, customer, template, cadence, dates, notes). */
export async function updateSabcrmRecurringInvoiceFull(
  id: string,
  patch: SabcrmRecurringInvoiceFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmRecurringInvoiceDoc>> {
  if (!id) return { ok: false, error: 'Schedule id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmRecurringInvoiceUpdateInput = {};
  if (patch.title !== undefined) wire.title = patch.title;
  if (patch.invoiceTemplateId !== undefined) {
    if (patch.invoiceTemplateId && !ObjectId.isValid(patch.invoiceTemplateId)) {
      return { ok: false, error: 'The invoice-to-clone reference is invalid.' };
    }
    wire.invoiceTemplateId = patch.invoiceTemplateId || undefined;
  }
  if (patch.customerId !== undefined) {
    if (!patch.customerId || !ObjectId.isValid(patch.customerId)) {
      return { ok: false, error: 'Pick a customer for this schedule.' };
    }
    wire.customerId = patch.customerId;
  }
  if (patch.frequency !== undefined) {
    if (!FREQUENCIES.has(patch.frequency)) {
      return { ok: false, error: 'Pick a valid frequency.' };
    }
    wire.frequency = patch.frequency;
  }
  if (patch.startDate !== undefined) {
    const iso = toIso(patch.startDate);
    if (!iso) return { ok: false, error: 'The start date is invalid.' };
    wire.startDate = iso;
  }
  if (patch.endDate !== undefined) {
    if (patch.endDate === '') {
      // Wire can't unset — leave absent.
    } else {
      const iso = toIso(patch.endDate);
      if (!iso) return { ok: false, error: 'The end date is invalid.' };
      wire.endDate = iso;
    }
  }
  if (patch.status !== undefined) {
    if (!RECURRING_STATUSES.has(patch.status)) {
      return { ok: false, error: 'Pick a valid schedule status.' };
    }
    wire.status = patch.status;
  }
  if (patch.notes !== undefined) wire.notes = patch.notes;
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmFinanceRecurringInvoicesApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(RECURRING_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the recurring invoice.');
  }
}

/* ─── Status transitions (pause / resume / stop) ───────────────── */

/**
 * Applies a workflow transition (active ⇄ paused, → stopped), validated
 * against the vocabulary AND the allowed-transition map.
 */
export async function transitionSabcrmRecurringInvoiceStatus(
  id: string,
  next: CrmRecurringInvoiceStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmRecurringInvoiceDoc>> {
  if (!id) return { ok: false, error: 'Schedule id is required.' };
  if (!RECURRING_STATUSES.has(next)) {
    return { ok: false, error: 'Invalid schedule status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmFinanceRecurringInvoicesApi.getById(
      g.ctx.projectId,
      id,
    );
    const from = (current.status ?? 'active') as CrmRecurringInvoiceStatus;
    if (!SABCRM_RECURRING_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a schedule from "${from}" to "${next}".`,
      };
    }
    const data = await sabcrmFinanceRecurringInvoicesApi.update(
      g.ctx.projectId,
      id,
      { status: next },
    );
    revalidatePath(RECURRING_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the schedule status.');
  }
}
