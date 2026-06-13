'use server';

/**
 * SabCRM People — Holidays server actions (P7 People suite, spec
 * `docs/sabcrm/rnd/people-suite.md` WI-17/WI-27).
 *
 * Data paths for `/sabcrm/people/holidays`: display-ready list rows,
 * full create / update / delete over the project-scoped engine mount,
 * and the capped CSV export. The crate's list filters are `year` +
 * `holidayType`; the actions derive `year` from the kit's date-range
 * `from` bound and refine `from`/`to` + free-text in-page.
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * `sabcrm-finance-invoices.actions.ts`. Engine failures normalise into
 * `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmPeopleHolidaysApi,
  type CrmHolidayCreateInput,
  type CrmHolidayDoc,
  type CrmHolidayUpdateInput,
} from '@/lib/rust-client/sabcrm-people-holidays';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmHolidayFormValues,
  SabcrmHolidayListFilters,
  SabcrmHolidayListPage,
  SabcrmHolidayListRow,
} from './sabcrm-people-holidays.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const PEOPLE_HOLIDAYS_PATH = '/sabcrm/people/holidays';

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

/* ─── Rows ────────────────────────────────────────────────────── */

function toListRow(doc: CrmHolidayDoc): SabcrmHolidayListRow {
  const locations = doc.applicableLocations ?? [];
  return {
    id: doc._id,
    date: doc.date,
    name: doc.name,
    holidayType: doc.holidayType ?? 'national',
    recurring: !!doc.recurring,
    locations: locations.join(', '),
    locationsList: locations,
    notes: doc.notes ?? '',
  };
}

/** Year for the engine filter, derived from the range's `from` bound. */
function yearOf(from?: string): number | undefined {
  if (!from) return undefined;
  const y = Number(from.slice(0, 4));
  return Number.isFinite(y) && y > 1900 ? y : undefined;
}

function refine(
  docs: CrmHolidayDoc[],
  filters: SabcrmHolidayListFilters,
): CrmHolidayDoc[] {
  let out = docs;
  if (filters.from || filters.to) {
    const fromKey = filters.from ?? '0000-00-00';
    const toKey = filters.to ?? '9999-12-31';
    out = out.filter((d) => {
      const day = (d.date ?? '').slice(0, 10);
      return day >= fromKey && day <= toKey;
    });
  }
  const q = (filters.q ?? '').trim().toLowerCase();
  if (q) {
    out = out.filter((d) =>
      [d.name, ...(d.applicableLocations ?? []), d.notes ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }
  return out;
}

/* ─── List + export ───────────────────────────────────────────── */

export async function listSabcrmHolidaysPage(
  filters: SabcrmHolidayListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmHolidayListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const docs = await sabcrmPeopleHolidaysApi.list(g.ctx.projectId, {
      page,
      limit,
      year: yearOf(filters.from),
      holidayType: filters.holidayType || undefined,
    });
    const hasMore = docs.length === limit;
    const rows = refine(docs, filters).map(toListRow);
    return { ok: true, data: { rows, page, hasMore } };
  } catch (e) {
    return fail(e, 'Failed to list holidays.');
  }
}

const SCAN_MAX_PAGES = 5;

/** Capped fetch-all (≤500) for CSV export, honouring filters. */
export async function exportSabcrmHolidayRows(
  filters: SabcrmHolidayListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmHolidayListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmHolidayDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const batch = await sabcrmPeopleHolidaysApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        year: yearOf(filters.from),
        holidayType: filters.holidayType || undefined,
      });
      docs.push(...batch);
      if (batch.length < 100) break;
    }
    return { ok: true, data: refine(docs, filters).map(toListRow) };
  } catch (e) {
    return fail(e, 'Failed to export holidays.');
  }
}

/* ─── Get (deep-linked edit drawer) ───────────────────────────── */

export async function getSabcrmHoliday(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmHolidayListRow>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmPeopleHolidaysApi.getById(g.ctx.projectId, id);
    return { ok: true, data: toListRow(doc) };
  } catch (e) {
    return fail(e, 'Failed to load the holiday.');
  }
}

/* ─── Create / update / delete ────────────────────────────────── */

function buildInput(
  values: SabcrmHolidayFormValues,
): CrmHolidayCreateInput | string {
  if (!values.name?.trim()) return 'Name is required.';
  const date = toIso(values.date);
  if (!date) return 'Date is required.';
  return {
    date,
    name: values.name.trim(),
    holidayType: values.holidayType || undefined,
    recurring: values.recurring ?? false,
    applicableLocations: (values.applicableLocations ?? [])
      .map((l) => l.trim())
      .filter(Boolean),
    notes: values.notes?.trim() || undefined,
  };
}

export async function createSabcrmHoliday(
  values: SabcrmHolidayFormValues,
  projectId?: string,
): Promise<ActionResult<CrmHolidayDoc>> {
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const input = buildInput(values);
  if (typeof input === 'string') return { ok: false, error: input };

  try {
    const doc = await sabcrmPeopleHolidaysApi.create(g.ctx.projectId, input);
    revalidatePath(PEOPLE_HOLIDAYS_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to create the holiday.');
  }
}

export async function updateSabcrmHoliday(
  id: string,
  values: SabcrmHolidayFormValues,
  projectId?: string,
): Promise<ActionResult<CrmHolidayDoc>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const built = buildInput(values);
  if (typeof built === 'string') return { ok: false, error: built };
  const patch: CrmHolidayUpdateInput = built;

  try {
    const doc = await sabcrmPeopleHolidaysApi.update(g.ctx.projectId, id, patch);
    revalidatePath(PEOPLE_HOLIDAYS_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the holiday.');
  }
}

export async function deleteSabcrmHoliday(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    await sabcrmPeopleHolidaysApi.delete(g.ctx.projectId, id);
    revalidatePath(PEOPLE_HOLIDAYS_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to delete the holiday.');
  }
}
