'use server';

/**
 * SabCRM People — Employees server actions (P7 People suite, spec
 * `docs/sabcrm/rnd/people-suite.md` WI-17/WI-24).
 *
 * Data paths for the flagship `/sabcrm/people/employees` surface:
 *
 *   - display-ready list rows (department labels resolved server-side —
 *     raw ObjectIds never reach the client) with KPI strip;
 *   - the picker searches every other People surface imports
 *     (`searchSabcrmEmployees`, `searchSabcrmDepartments`,
 *     `searchSabcrmDesignations`) plus the form-local shift /
 *     salary-structure option searches;
 *   - full create / update / delete over the project-scoped engine
 *     mount, plus the detail page's resolved-label bundle and the
 *     Activity rail (attendance 30d / leave applications / payslips).
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * `sabcrm-finance-invoices.actions.ts` (lines 86–127 there — copied
 * verbatim). The Rust engine may be down at dev time — failures are
 * normalised into `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmPeopleEmployeesApi,
  sabcrmPeopleEmployeeOptionsApi,
  sabcrmPeopleEmployeeActivityApi,
  type CrmEmployeeCreateInput,
  type CrmEmployeeStatus,
  type CrmEmployeeUpdateInput,
  type SabcrmEmployeeDoc,
} from '@/lib/rust-client/sabcrm-people-employees';
import {
  crmDepartmentsApi,
  crmDesignationsApi,
  type CrmDepartmentDoc,
} from '@/lib/rust-client/crm-departments';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmEmployeeActivity,
  SabcrmEmployeeActivityRef,
  SabcrmEmployeeCreateValues,
  SabcrmEmployeeDetail,
  SabcrmEmployeeKpis,
  SabcrmEmployeeListFilters,
  SabcrmEmployeeListPage,
  SabcrmEmployeeListRow,
  SabcrmEmployeeUpdateValues,
  SabcrmPeopleEntityOption,
} from './sabcrm-people-employees.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const PEOPLE_EMPLOYEES_PATH = '/sabcrm/people/employees';

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

/* ─── Labels ──────────────────────────────────────────────────── */

/** `displayName ?? firstName + lastName` — never an ObjectId. */
function employeeLabel(doc: SabcrmEmployeeDoc): string {
  const full = [doc.firstName, doc.lastName].filter(Boolean).join(' ').trim();
  return doc.displayName?.trim() || full || doc.employeeId || 'Employee';
}

/** Batch-resolve department ids → name labels (legacy user mount). */
async function resolveDepartmentLabels(
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 100);
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const dep: CrmDepartmentDoc = await crmDepartmentsApi.getById(id);
        if (dep?.name) map.set(id, dep.name);
      } catch {
        // Gone / cross-tenant — render "Unknown", never the id.
      }
    }),
  );
  return map;
}

function toListRow(
  doc: SabcrmEmployeeDoc,
  departmentLabels: Map<string, string>,
): SabcrmEmployeeListRow {
  return {
    id: doc._id,
    employeeCode: doc.employeeId ?? '',
    name: employeeLabel(doc),
    workEmail: doc.workEmail ?? '',
    designation: doc.designation ?? '',
    departmentId: doc.departmentId ?? '',
    departmentLabel: doc.departmentId
      ? (departmentLabels.get(doc.departmentId) ?? null)
      : null,
    employmentType: doc.employmentType ?? '',
    joiningDate: doc.joiningDate,
    ctc: doc.ctc ?? 0,
    currency: 'INR',
    status: doc.status ?? 'active',
  };
}

/** In-page joiningDate range refinement (engine has no date filter). */
function refineByJoiningDate(
  docs: SabcrmEmployeeDoc[],
  from?: string,
  to?: string,
): SabcrmEmployeeDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.joiningDate ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

/* ─── List page (display-ready rows) ──────────────────────────── */

/**
 * Lists a page of display-ready employee rows. `hasMore` is derived
 * from a full page (`docs.length === limit`) — same boundary semantics
 * as the invoices reference vertical.
 */
export async function listSabcrmEmployeesPage(
  filters: SabcrmEmployeeListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmEmployeeListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const docs = await sabcrmPeopleEmployeesApi.list(g.ctx.projectId, {
      page,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
      departmentId: filters.departmentId || undefined,
    });

    const pageDocs = refineByJoiningDate(docs, filters.from, filters.to);
    const hasMore = docs.length === limit;

    const labels = await resolveDepartmentLabels(
      pageDocs.map((d) => d.departmentId ?? ''),
    );

    return {
      ok: true,
      data: { rows: pageDocs.map((d) => toListRow(d, labels)), page, hasMore },
    };
  } catch (e) {
    return fail(e, 'Failed to list employees.');
  }
}

/** Pages the list endpoint scans for KPIs / CSV (100 docs each). */
const SCAN_MAX_PAGES = 5;

/** Capped fetch-all (≤500) for CSV export, honouring filters. */
export async function exportSabcrmEmployeeRows(
  filters: SabcrmEmployeeListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmEmployeeListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmEmployeeDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const batch = await sabcrmPeopleEmployeesApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
        departmentId: filters.departmentId || undefined,
      });
      docs.push(...batch);
      if (batch.length < 100) break;
    }
    const rows = refineByJoiningDate(docs, filters.from, filters.to);
    const labels = await resolveDepartmentLabels(
      rows.map((d) => d.departmentId ?? ''),
    );
    return { ok: true, data: rows.map((d) => toListRow(d, labels)) };
  } catch (e) {
    return fail(e, 'Failed to export employees.');
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

/** Headcount / active / on-leave / joiners-this-month (capped scan). */
export async function getSabcrmEmployeeKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmEmployeeKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmEmployeeDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const batch = await sabcrmPeopleEmployeesApi.list(g.ctx.projectId, {
        page,
        limit: 100,
      });
      docs.push(...batch);
      if (batch.length < 100) break;
      if (page === SCAN_MAX_PAGES) sampled = true;
    }

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    let active = 0;
    let onLeave = 0;
    let joinersThisMonth = 0;
    for (const doc of docs) {
      const status = doc.status ?? 'active';
      if (status === 'active') active += 1;
      if (status === 'on_leave') onLeave += 1;
      if ((doc.joiningDate ?? '').slice(0, 7) === monthKey) {
        joinersThisMonth += 1;
      }
    }

    return {
      ok: true,
      data: { headcount: docs.length, active, onLeave, joinersThisMonth, sampled },
    };
  } catch (e) {
    return fail(e, 'Failed to compute employee KPIs.');
  }
}

/* ─── Get / create / update / delete ──────────────────────────── */

/** Fetches one employee + every FK resolved to a display label. */
export async function getSabcrmEmployee(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmEmployeeDetail>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmPeopleEmployeesApi.getById(g.ctx.projectId, id);

    const [department, manager, dotted, shift, structure] = await Promise.all([
      doc.departmentId
        ? crmDepartmentsApi.getById(doc.departmentId).catch(() => null)
        : Promise.resolve(null),
      doc.reportingManagerId
        ? sabcrmPeopleEmployeesApi
            .getById(g.ctx.projectId, doc.reportingManagerId)
            .catch(() => null)
        : Promise.resolve(null),
      doc.dottedLineManagerId
        ? sabcrmPeopleEmployeesApi
            .getById(g.ctx.projectId, doc.dottedLineManagerId)
            .catch(() => null)
        : Promise.resolve(null),
      doc.shiftId
        ? sabcrmPeopleEmployeeOptionsApi
            .getShift(g.ctx.projectId, doc.shiftId)
            .catch(() => null)
        : Promise.resolve(null),
      doc.salaryStructureId
        ? sabcrmPeopleEmployeeOptionsApi
            .getSalaryStructure(g.ctx.projectId, doc.salaryStructureId)
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    return {
      ok: true,
      data: {
        doc,
        labels: {
          department: department?.name ?? null,
          designation: doc.designation ?? null,
          reportingManager: manager ? employeeLabel(manager) : null,
          dottedLineManager: dotted ? employeeLabel(dotted) : null,
          shift: shift?.name ?? null,
          salaryStructure: structure?.name ?? null,
        },
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load the employee.');
  }
}

function buildCreateInput(
  values: SabcrmEmployeeCreateValues,
): CrmEmployeeCreateInput | string {
  if (!values.firstName?.trim()) return 'First name is required.';
  if (!values.lastName?.trim()) return 'Last name is required.';
  if (!values.workEmail?.trim()) return 'Work email is required.';
  if (!values.departmentId) return 'Pick a department.';
  if (!values.designationId) return 'Pick a designation.';
  if (!values.salaryStructureId) return 'Pick a salary structure.';
  const dob = toIso(values.dob);
  if (!dob) return 'Date of birth is required.';
  const joiningDate = toIso(values.joiningDate);
  if (!joiningDate) return 'Joining date is required.';

  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    displayName: values.displayName?.trim() || undefined,
    salutation: values.salutation?.trim() || undefined,
    dob,
    gender: values.gender || undefined,
    personalEmail: values.personalEmail?.trim() || undefined,
    personalPhone: values.personalPhone?.trim() || undefined,
    joiningDate,
    departmentId: values.departmentId,
    designationId: values.designationId,
    workEmail: values.workEmail.trim(),
    salaryStructureId: values.salaryStructureId,
    workPhone: values.workPhone?.trim() || undefined,
    employmentType: values.employmentType || undefined,
    reportingManagerId: values.reportingManagerId || undefined,
    dottedLineManagerId: values.dottedLineManagerId || undefined,
    ctc: values.ctc,
    variablePct: values.variablePct,
    noticePeriodDays: values.noticePeriodDays,
    status: values.status || undefined,
  };
}

export async function createSabcrmEmployee(
  values: SabcrmEmployeeCreateValues,
  projectId?: string,
): Promise<ActionResult<SabcrmEmployeeDoc>> {
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const input = buildCreateInput(values);
  if (typeof input === 'string') return { ok: false, error: input };

  try {
    const doc = await sabcrmPeopleEmployeesApi.create(g.ctx.projectId, input);
    revalidatePath(PEOPLE_EMPLOYEES_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to create the employee.');
  }
}

export async function updateSabcrmEmployee(
  id: string,
  values: SabcrmEmployeeUpdateValues,
  projectId?: string,
): Promise<ActionResult<SabcrmEmployeeDoc>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const patch: CrmEmployeeUpdateInput = {
    firstName: values.firstName?.trim() || undefined,
    lastName: values.lastName?.trim() || undefined,
    displayName: values.displayName?.trim() || undefined,
    salutation: values.salutation?.trim() || undefined,
    dob: values.dob ? (toIso(values.dob) ?? undefined) : undefined,
    gender: values.gender || undefined,
    personalEmail: values.personalEmail?.trim() || undefined,
    personalPhone: values.personalPhone?.trim() || undefined,
    workEmail: values.workEmail?.trim() || undefined,
    workPhone: values.workPhone?.trim() || undefined,
    joiningDate: values.joiningDate
      ? (toIso(values.joiningDate) ?? undefined)
      : undefined,
    departmentId: values.departmentId || undefined,
    designationId: values.designationId || undefined,
    salaryStructureId: values.salaryStructureId || undefined,
    employmentType: values.employmentType || undefined,
    reportingManagerId: values.reportingManagerId || undefined,
    dottedLineManagerId: values.dottedLineManagerId || undefined,
    ctc: values.ctc,
    variablePct: values.variablePct,
    noticePeriodDays: values.noticePeriodDays,
    status: values.status || undefined,
  };
  if (Object.values(patch).every((v) => v === undefined)) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const doc = await sabcrmPeopleEmployeesApi.update(g.ctx.projectId, id, patch);
    revalidatePath(PEOPLE_EMPLOYEES_PATH);
    revalidatePath(`${PEOPLE_EMPLOYEES_PATH}/${id}`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the employee.');
  }
}

/** Lifecycle shortcut for the detail ConvertMenu (status PATCH). */
export async function transitionSabcrmEmployeeStatus(
  id: string,
  status: CrmEmployeeStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmEmployeeDoc>> {
  return updateSabcrmEmployee(id, { status }, projectId);
}

export async function deleteSabcrmEmployee(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    await sabcrmPeopleEmployeesApi.delete(g.ctx.projectId, id);
    revalidatePath(PEOPLE_EMPLOYEES_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to delete the employee.');
  }
}

/* ─── Picker searches ─────────────────────────────────────────── */

/**
 * Employee picker search — label = `displayName ?? firstName+lastName`,
 * meta = `employeeId · workEmail`. The shared picker every other
 * People surface imports.
 */
export async function searchSabcrmEmployees(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmPeopleEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await sabcrmPeopleEmployeesApi.list(g.ctx.projectId, {
      q: q.trim() || undefined,
      limit: 12,
    });
    return {
      ok: true,
      data: docs.map((d) => ({
        id: d._id,
        label: employeeLabel(d),
        meta:
          [d.employeeId, d.workEmail].filter(Boolean).join(' · ') || undefined,
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search employees.');
  }
}

/** Department picker (legacy `/v1/crm/departments` user mount). */
export async function searchSabcrmDepartments(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmPeopleEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await crmDepartmentsApi.list({
      q: q.trim() || undefined,
      limit: 12,
    });
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

/** Designation picker (legacy `/v1/crm/designations` user mount). */
export async function searchSabcrmDesignations(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmPeopleEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await crmDesignationsApi.list({
      q: q.trim() || undefined,
      limit: 12,
    });
    return {
      ok: true,
      data: docs.map((d) => ({
        id: d._id,
        label: d.name,
        meta: d.grade || d.code || undefined,
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search designations.');
  }
}

/** Shift picker over `/v1/sabcrm/people/shifts` (employee form local). */
export async function searchSabcrmEmployeeShifts(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmPeopleEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await sabcrmPeopleEmployeeOptionsApi.searchShifts(
      g.ctx.projectId,
      q.trim() || undefined,
    );
    return {
      ok: true,
      data: docs.map((d) => ({
        id: d._id,
        label: d.name ?? d.code ?? 'Shift',
        meta:
          d.startTime && d.endTime ? `${d.startTime} to ${d.endTime}` : d.code,
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search shifts.');
  }
}

/** Rich salary-structure picker over the People mount (WI-8 shape). */
export async function searchSabcrmEmployeeSalaryStructures(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmPeopleEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await sabcrmPeopleEmployeeOptionsApi.searchSalaryStructures(
      g.ctx.projectId,
      q.trim() || undefined,
    );
    return {
      ok: true,
      data: docs.map((d) => ({
        id: d._id,
        label: d.name ?? 'Salary structure',
        meta: d.effectiveDate
          ? `Effective ${(d.effectiveDate ?? '').slice(0, 10)}`
          : undefined,
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search salary structures.');
  }
}

/* ─── Activity rail (detail page) ─────────────────────────────── */

/**
 * Attendance (last 30 days) + leave applications + payslips for one
 * employee — the three lists in the detail Activity rail.
 */
export async function getSabcrmEmployeeActivity(
  employeeId: string,
  projectId?: string,
): Promise<ActionResult<SabcrmEmployeeActivity>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const dateFrom = new Date(Date.now() - 30 * 86_400_000).toISOString();

  try {
    const [attendance, leaves, payslips] = await Promise.all([
      sabcrmPeopleEmployeeActivityApi
        .listAttendance(g.ctx.projectId, employeeId, dateFrom)
        .catch(() => []),
      sabcrmPeopleEmployeeActivityApi
        .listLeaveApplications(g.ctx.projectId, employeeId)
        .catch(() => []),
      sabcrmPeopleEmployeeActivityApi
        .listPayslips(g.ctx.projectId, employeeId)
        .catch(() => []),
    ]);

    const attendanceRefs: SabcrmEmployeeActivityRef[] = attendance.map((a) => ({
      id: a._id,
      label: (a.status ?? 'present').replaceAll('_', ' '),
      date: a.date,
      status: a.status,
      href: `/sabcrm/people/attendance?row=${encodeURIComponent(a._id)}`,
    }));
    const leaveRefs: SabcrmEmployeeActivityRef[] = leaves.map((l) => ({
      id: l._id,
      label:
        l.from && l.to
          ? `${(l.from ?? '').slice(0, 10)} to ${(l.to ?? '').slice(0, 10)}${l.days ? ` (${l.days}d)` : ''}`
          : 'Leave application',
      date: l.from,
      status: l.status,
      href: '/sabcrm/people/leave',
    }));
    const payslipRefs: SabcrmEmployeeActivityRef[] = payslips.map((p) => ({
      id: p._id,
      label: p.periodLabel ?? p.payPeriod ?? 'Payslip',
      status: p.status,
      amount: p.netPay ?? p.net,
      currency: 'INR',
      href: `/sabcrm/people/payslips/${encodeURIComponent(p._id)}`,
    }));

    return {
      ok: true,
      data: {
        attendance: attendanceRefs,
        leaves: leaveRefs,
        payslips: payslipRefs,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load the employee activity.');
  }
}
