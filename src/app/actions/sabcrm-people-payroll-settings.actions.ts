'use server';

/**
 * SabCRM People — Payroll Settings server actions (people-suite WI-35).
 *
 * Drives the `/sabcrm/people/settings` single-card surface over the
 * project-scoped singleton mount (WI-14): `getSabcrmPayrollSettings`
 * reads the project's one settings document (`null` until first save)
 * and `saveSabcrmPayrollSettings` upserts it (companyName, PF/ESI
 * rates, pay cycle, tax-slab table, default currency, status).
 *
 * The saved `companyName` also feeds the rich payslip header that
 * `generate-payslips` (WI-7) freezes — so this surface is part of the
 * payroll spine, not an optional extra.
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * the finance invoices actions (verbatim recipe). Engine failures
 * normalise into `{ ok: false, error }`. Fetched docs are deflated
 * from MongoDB extended JSON before use.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmPeoplePayrollSettingsApi,
  type CrmPayrollSettingDoc,
  type CrmPayrollSettingTaxSlab,
} from '@/lib/rust-client/sabcrm-people-payroll-settings';
import { deflateDoc } from '@/lib/sabcrm/finance-extjson';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { SabcrmPayrollSettingsInput } from './sabcrm-people-payroll-settings.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const SETTINGS_PATH = '/sabcrm/people/settings';

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

/* ─── Validation ─────────────────────────────────────────────────── */

function cleanRate(
  raw: number | undefined,
  label: string,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (raw == null) return { ok: true, value: undefined };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return { ok: false, error: `${label} must be a percentage between 0 and 100.` };
  }
  return { ok: true, value: n };
}

function cleanTaxSlabs(
  raw: CrmPayrollSettingTaxSlab[] | undefined,
): { ok: true; slabs: CrmPayrollSettingTaxSlab[] } | { ok: false; error: string } {
  const slabs: CrmPayrollSettingTaxSlab[] = [];
  for (const [i, slab] of (raw ?? []).entries()) {
    const min = slab.min == null ? undefined : Number(slab.min);
    const max = slab.max == null ? undefined : Number(slab.max);
    const rate = slab.rate == null ? undefined : Number(slab.rate);
    const empty = min == null && max == null && rate == null;
    if (empty) continue; // blank repeater row — skip
    if (min == null || !Number.isFinite(min) || min < 0) {
      return { ok: false, error: `Tax slab ${i + 1} needs a minimum ≥ 0.` };
    }
    if (max != null && (!Number.isFinite(max) || max < min)) {
      return {
        ok: false,
        error: `Tax slab ${i + 1} maximum must be above its minimum.`,
      };
    }
    if (rate == null || !Number.isFinite(rate) || rate < 0 || rate > 100) {
      return { ok: false, error: `Tax slab ${i + 1} needs a rate 0–100%.` };
    }
    slabs.push({ min, max, rate });
  }
  return { ok: true, slabs };
}

/* ─── Read (singleton) ───────────────────────────────────────────── */

export async function getSabcrmPayrollSettings(
  projectId?: string,
): Promise<ActionResult<CrmPayrollSettingDoc | null>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmPeoplePayrollSettingsApi.getSingleton(
      g.ctx.projectId,
    );
    return { ok: true, data: doc ? deflateDoc(doc) : null };
  } catch (e) {
    return fail(e, 'Failed to load payroll settings.');
  }
}

/* ─── Upsert ─────────────────────────────────────────────────────── */

export async function saveSabcrmPayrollSettings(
  input: SabcrmPayrollSettingsInput,
  projectId?: string,
): Promise<ActionResult<CrmPayrollSettingDoc>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  if (!input.payCycle) {
    return { ok: false, error: 'Pay cycle is required.' };
  }
  const pf = cleanRate(input.pfRate, 'PF rate');
  if (!pf.ok) return { ok: false, error: pf.error };
  const esi = cleanRate(input.esiRate, 'ESI rate');
  if (!esi.ok) return { ok: false, error: esi.error };
  const slabs = cleanTaxSlabs(input.taxSlabs);
  if (!slabs.ok) return { ok: false, error: slabs.error };

  try {
    const doc = deflateDoc<CrmPayrollSettingDoc>(
      await sabcrmPeoplePayrollSettingsApi.upsert(g.ctx.projectId, {
        companyName: input.companyName?.trim() || undefined,
        pfRate: pf.value,
        esiRate: esi.value,
        payCycle: input.payCycle,
        taxSlabs: slabs.slabs,
        defaultCurrency: input.defaultCurrency?.trim() || undefined,
        status: input.status ?? 'active',
      }),
    );
    revalidatePath(SETTINGS_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to save payroll settings.');
  }
}
