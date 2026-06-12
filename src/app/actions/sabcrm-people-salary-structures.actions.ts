'use server';

/**
 * SabCRM People — Salary Structures server actions (people-suite WI-31).
 *
 * Drives the `/sabcrm/people/salary-structures` surface over the
 * project-scoped RICH mount (crate `crm-salary-structures::rich`,
 * §2.1.2 schema-collision fix): full CRUD of the canonical
 * `hrm_payroll_types::SalaryStructure` shape payroll compute consumes
 * (`name`, `effectiveDate`, `components[]` with their `calc` strategy,
 * `applicableTo[]`, `active`). The legacy flat CRUD stays untouched on
 * its user-scoped mount.
 *
 *   - display-ready list rows (component roll-ups + applicability
 *     summaries with employee/department labels batch-resolved) + CSV;
 *   - full-field create/update with component + applicability
 *     validation (codes uppercase/unique, calc payload per kind,
 *     offsets, caps);
 *   - pickers: `searchSabcrmSalaryStructures` (the spec-binding picker
 *     other surfaces import), employee + department target pickers;
 *   - edit-drawer seed (`getSabcrmSalaryStructure`) with resolved
 *     target labels.
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * the finance invoices actions (verbatim recipe). Engine failures
 * normalise into `{ ok: false, error }`. All fetched docs are deflated
 * from MongoDB extended JSON before use.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmPeopleSalaryStructuresApi,
  type SabcrmApplicability,
  type SabcrmSalaryComponent,
  type SabcrmSalaryStructureDoc,
} from '@/lib/rust-client/sabcrm-people-salary-structures';
import {
  sabcrmPeoplePayrollEmployeesApi,
  type CrmEmployeeDoc,
} from '@/lib/rust-client/sabcrm-people-payroll-runs';
import {
  crmDepartmentsApi,
  type CrmDepartmentDoc,
} from '@/lib/rust-client/crm-departments';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { DocEntityOption } from '@/app/sabcrm/finance/_components/doc-surface/types';
import type {
  SabcrmSalaryStructureInput,
  SabcrmSalaryStructureListFilters,
  SabcrmSalaryStructureListPage,
  SabcrmSalaryStructureListRow,
  SabcrmSalaryStructureView,
} from './sabcrm-people-salary-structures.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const SALARY_STRUCTURES_PATH = '/sabcrm/people/salary-structures';
const PAGE_SIZE = 20;

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

/* ─── Validation (full rich field set) ──────────────────────────── */

function validateStructureInput(
  input: SabcrmSalaryStructureInput,
):
  | {
      ok: true;
      payload: {
        name: string;
        effectiveDate: string;
        components: SabcrmSalaryComponent[];
        applicableTo: SabcrmApplicability[];
        active: boolean;
      };
    }
  | { ok: false; error: string } {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'Structure name is required.' };
  const effectiveDate = input.effectiveDate ? toIso(input.effectiveDate) : null;
  if (!effectiveDate) {
    return { ok: false, error: 'Effective date is required.' };
  }

  const components: SabcrmSalaryComponent[] = [];
  const seenCodes = new Set<string>();
  for (const [i, raw] of (input.components ?? []).entries()) {
    const cname = raw.name?.trim();
    const code = raw.code?.trim().toUpperCase();
    if (!cname && !code) continue; // blank repeater row — skip
    if (!cname) {
      return { ok: false, error: `Component ${i + 1} needs a name.` };
    }
    if (!code) {
      return { ok: false, error: `Component "${cname}" needs a code.` };
    }
    if (seenCodes.has(code)) {
      return { ok: false, error: `Component code "${code}" is duplicated.` };
    }
    seenCodes.add(code);

    const calc = raw.calc;
    if (calc.kind === 'fixed') {
      if (!Number.isFinite(calc.amount) || calc.amount < 0) {
        return { ok: false, error: `"${cname}" needs a fixed amount ≥ 0.` };
      }
    } else if (calc.kind === 'percent_basic' || calc.kind === 'percent_ctc') {
      if (!Number.isFinite(calc.pct) || calc.pct < 0 || calc.pct > 100) {
        return { ok: false, error: `"${cname}" needs a percentage 0–100.` };
      }
    } else if (calc.kind === 'formula') {
      const expr = calc.expr?.trim();
      if (!expr) {
        return { ok: false, error: `"${cname}" needs a formula expression.` };
      }
      // Engine grammar: + - * / ( ) , unary minus, min()/max() (WI-6)
      // and the identifiers basic|ctc|monthlyCtc|annualCtc.
      if (!/^[\w\s+\-*/().,]+$/.test(expr)) {
        return {
          ok: false,
          error: `"${cname}" formula contains unsupported characters.`,
        };
      }
    } else {
      return { ok: false, error: `"${cname}" has an unknown calc kind.` };
    }
    if (
      raw.maxCap != null &&
      raw.minCap != null &&
      raw.maxCap < raw.minCap
    ) {
      return { ok: false, error: `"${cname}" max cap is below its min cap.` };
    }
    components.push({
      name: cname,
      code,
      type: raw.type,
      calc,
      taxable: Boolean(raw.taxable),
      statutory: Boolean(raw.statutory),
      prorate: Boolean(raw.prorate),
      frequency: raw.frequency ?? 'monthly',
      maxCap: raw.maxCap ?? undefined,
      minCap: raw.minCap ?? undefined,
    });
  }
  if (components.length === 0) {
    return { ok: false, error: 'Add at least one salary component.' };
  }

  const applicableTo: SabcrmApplicability[] = [];
  for (const rule of input.applicableTo ?? []) {
    const id = rule.id?.trim();
    if (!id) continue; // unpicked repeater row — skip
    if (rule.kind === 'employee' || rule.kind === 'department') {
      if (!ObjectId.isValid(id)) {
        return {
          ok: false,
          error: `An "applies to" ${rule.kind} target is invalid — pick it from the list.`,
        };
      }
    }
    applicableTo.push({ kind: rule.kind, id });
  }

  return {
    ok: true,
    payload: {
      name,
      effectiveDate,
      components,
      applicableTo,
      active: input.active !== false,
    },
  };
}

/* ─── Label resolution (applicability summaries) ────────────────── */

function employeeDisplayLabel(e: CrmEmployeeDoc): string {
  const display = e.displayName?.trim();
  if (display) return display;
  const full = `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim();
  return full || e.employeeId || 'Employee';
}

async function targetLabelMap(
  projectId: string,
  rules: SabcrmApplicability[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const employeeIds = new Set(
    rules.filter((r) => r.kind === 'employee').map((r) => r.id),
  );
  const departmentIds = new Set(
    rules.filter((r) => r.kind === 'department').map((r) => r.id),
  );

  const jobs: Promise<void>[] = [];
  if (employeeIds.size > 0) {
    jobs.push(
      (async () => {
        try {
          for (let page = 1; page <= 3; page++) {
            const docs = deflateDocs<CrmEmployeeDoc>(
              await sabcrmPeoplePayrollEmployeesApi.list(projectId, {
                page,
                limit: 100,
              }),
            );
            for (const e of docs) {
              if (employeeIds.has(e._id)) {
                map.set(e._id, employeeDisplayLabel(e));
              }
            }
            if (docs.length < 100) break;
          }
        } catch {
          /* summary falls back to the kind label */
        }
      })(),
    );
  }
  if (departmentIds.size > 0) {
    jobs.push(
      (async () => {
        try {
          const docs = deflateDocs<CrmDepartmentDoc>(
            await crmDepartmentsApi.list({ limit: 200 }),
          );
          for (const d of docs) {
            if (departmentIds.has(d._id)) map.set(d._id, d.name);
          }
        } catch {
          /* summary falls back to the kind label */
        }
      })(),
    );
  }
  await Promise.all(jobs);
  return map;
}

function applicabilitySummary(
  rules: SabcrmApplicability[] | undefined,
  labels: Map<string, string>,
): string {
  if (!rules || rules.length === 0) return 'All employees';
  const parts = rules.slice(0, 3).map((r) => {
    if (r.kind === 'grade') return `Grade ${r.id}`;
    const label = labels.get(r.id);
    if (label) return label;
    return r.kind === 'employee' ? 'An employee' : 'A department';
  });
  const extra = rules.length - 3;
  return extra > 0 ? `${parts.join(' · ')} +${extra}` : parts.join(' · ');
}

function toRow(
  doc: SabcrmSalaryStructureDoc,
  labels: Map<string, string>,
): SabcrmSalaryStructureListRow {
  const components = doc.components ?? [];
  const active = doc.active !== false;
  return {
    id: doc._id,
    name: doc.name,
    effectiveDate: doc.effectiveDate,
    componentCount: components.length,
    earningCount: components.filter((c) => c.type === 'earning').length,
    deductionCount: components.filter((c) => c.type === 'deduction').length,
    reimbursementCount: components.filter((c) => c.type === 'reimbursement')
      .length,
    applicabilitySummary: applicabilitySummary(doc.applicableTo, labels),
    active,
    status: active ? 'active' : 'inactive',
  };
}

/* ─── List + export ──────────────────────────────────────────────── */

function statusToActive(status: string): boolean | undefined {
  if (status === 'active') return true;
  if (status === 'inactive') return false;
  return undefined;
}

export async function listSabcrmSalaryStructuresPage(
  filters: SabcrmSalaryStructureListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmSalaryStructureListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmPeopleSalaryStructuresApi.list(g.ctx.projectId, {
      page: Math.max(1, filters.page),
      limit: PAGE_SIZE,
      q: filters.q?.trim() || undefined,
      active: statusToActive(filters.status),
    });
    const docs = deflateDocs<SabcrmSalaryStructureDoc>(res.items);
    const labels = await targetLabelMap(
      g.ctx.projectId,
      docs.flatMap((d) => d.applicableTo ?? []),
    );
    return {
      ok: true,
      data: { rows: docs.map((d) => toRow(d, labels)), hasMore: res.hasMore },
    };
  } catch (e) {
    return fail(e, 'Failed to load salary structures.');
  }
}

/** Capped fetch-all for the CSV export (≤ 5 pages of 100). */
export async function exportSabcrmSalaryStructureRows(
  filters: SabcrmSalaryStructureListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmSalaryStructureListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const all: SabcrmSalaryStructureDoc[] = [];
    for (let page = 1; page <= 5; page++) {
      const res = await sabcrmPeopleSalaryStructuresApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q?.trim() || undefined,
        active: statusToActive(filters.status),
      });
      all.push(...deflateDocs<SabcrmSalaryStructureDoc>(res.items));
      if (!res.hasMore) break;
    }
    const labels = await targetLabelMap(
      g.ctx.projectId,
      all.flatMap((d) => d.applicableTo ?? []),
    );
    return { ok: true, data: all.map((d) => toRow(d, labels)) };
  } catch (e) {
    return fail(e, 'Failed to export salary structures.');
  }
}

/* ─── Pickers ────────────────────────────────────────────────────── */

/** Spec-binding picker — other People surfaces import this. */
export async function searchSabcrmSalaryStructures(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmPeopleSalaryStructuresApi.list(g.ctx.projectId, {
      q: q.trim() || undefined,
      limit: 12,
      active: true,
    });
    const docs = deflateDocs<SabcrmSalaryStructureDoc>(res.items);
    return {
      ok: true,
      data: docs.map((d) => ({
        id: d._id,
        label: d.name,
        meta: `${d.components?.length ?? 0} components`,
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search salary structures.');
  }
}

/** Employee target picker for the applicability repeater. */
export async function searchSabcrmStructureEmployees(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = deflateDocs<CrmEmployeeDoc>(
      await sabcrmPeoplePayrollEmployeesApi.list(g.ctx.projectId, {
        q: q.trim() || undefined,
        limit: 12,
      }),
    );
    return {
      ok: true,
      data: docs.map((e) => ({
        id: e._id,
        label: employeeDisplayLabel(e),
        meta:
          [e.employeeId, e.workEmail].filter(Boolean).join(' · ') || undefined,
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search employees.');
  }
}

/** Department target picker for the applicability repeater. */
export async function searchSabcrmStructureDepartments(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = deflateDocs<CrmDepartmentDoc>(
      await crmDepartmentsApi.list({ q: q.trim() || undefined, limit: 12 }),
    );
    return {
      ok: true,
      data: docs.map((d) => ({
        id: d._id,
        label: d.name,
        meta: d.code || undefined,
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search departments.');
  }
}

/* ─── Get / create / update / delete ─────────────────────────────── */

export async function getSabcrmSalaryStructure(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmSalaryStructureView>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = deflateDoc<SabcrmSalaryStructureDoc>(
      await sabcrmPeopleSalaryStructuresApi.getById(g.ctx.projectId, id),
    );
    const labels = await targetLabelMap(g.ctx.projectId, doc.applicableTo ?? []);
    return {
      ok: true,
      data: { doc, targetLabels: Object.fromEntries(labels) },
    };
  } catch (e) {
    return fail(e, 'Failed to load the salary structure.');
  }
}

export async function createSabcrmSalaryStructure(
  input: SabcrmSalaryStructureInput,
  projectId?: string,
): Promise<ActionResult<{ id: string; name: string }>> {
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const v = validateStructureInput(input);
  if (!v.ok) return { ok: false, error: v.error };

  try {
    const res = await sabcrmPeopleSalaryStructuresApi.create(
      g.ctx.projectId,
      v.payload,
    );
    revalidatePath(SALARY_STRUCTURES_PATH);
    return { ok: true, data: { id: res.id, name: v.payload.name } };
  } catch (e) {
    return fail(e, 'Failed to create the salary structure.');
  }
}

export async function updateSabcrmSalaryStructure(
  id: string,
  input: SabcrmSalaryStructureInput,
  projectId?: string,
): Promise<ActionResult<{ id: string; name: string }>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const v = validateStructureInput(input);
  if (!v.ok) return { ok: false, error: v.error };

  try {
    await sabcrmPeopleSalaryStructuresApi.update(
      g.ctx.projectId,
      id,
      v.payload,
    );
    revalidatePath(SALARY_STRUCTURES_PATH);
    return { ok: true, data: { id, name: v.payload.name } };
  } catch (e) {
    return fail(e, 'Failed to update the salary structure.');
  }
}

export async function deleteSabcrmSalaryStructure(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    await sabcrmPeopleSalaryStructuresApi.delete(g.ctx.projectId, id);
    revalidatePath(SALARY_STRUCTURES_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to delete the salary structure.');
  }
}
