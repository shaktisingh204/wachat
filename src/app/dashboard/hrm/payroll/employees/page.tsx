/**
 * Canonical Employees list — `/dashboard/hrm/payroll/employees`.
 *
 * Server component. Reads page/limit/q from the URL, hands the data to
 * `<EmployeesListClient>` for the §1D experience (KPI strip, filters,
 * view switcher, bulk bar, org-chart).
 *
 * Pulls a wider window for the KPI strip so the aggregate isn't capped
 * by `limit`. The Rust BFF (`crmEmployeesApi`) is the source of truth;
 * we never touch Mongo from this page.
 *
 * Per CRM_REBUILD_PLAN §1D.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listEmployees } from '@/app/actions/crm/employees.actions';
import { getSession } from '@/app/actions/user.actions';
import { getT } from '@/lib/i18n/server';
import {
  crmEmployeesApi,
  type CrmEmployeeDoc,
} from '@/lib/rust-client/crm-employees';

import { EmployeesListClient } from './_components/employees-list-client';
import { computeEmployeeKpis } from './_components/kpi';
import type { EmployeeListRow } from './_components/types';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

function toRow(doc: CrmEmployeeDoc): EmployeeListRow {
  return {
    _id: String(doc._id),
    employeeId: doc.employeeId,
    firstName: doc.firstName,
    lastName: doc.lastName,
    displayName: doc.displayName,
    photoFileId: doc.photoFileId,
    workEmail: doc.workEmail,
    workPhone: doc.workPhone,
    personalPhone: doc.personalPhone,
    departmentId: doc.departmentId ?? null,
    designationId: doc.designationId ?? null,
    designation: doc.designation,
    reportingManagerId: doc.reportingManagerId ?? null,
    status: doc.status,
    employmentType: doc.employmentType,
    joiningDate: doc.joiningDate ?? null,
    exitDate: doc.exitDate ?? null,
    workLocation: doc.workLocation,
    ctc: doc.ctc,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export default async function EmployeesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const session = await getSession();
  const [t, { employees: pageEmployees, hasMore, error }, kpiSource] =
    await Promise.all([
      getT(),
      listEmployees({ page, limit, q: q || undefined }),
      // Wider window for the KPI aggregate so a single page doesn't
      // skew the strip. Capped at 200 — the Rust endpoint enforces its
      // own upper bound.
      crmEmployeesApi
        .list({ page: 1, limit: 200 })
        .catch(() => [] as CrmEmployeeDoc[]),
    ]);

  const rows: EmployeeListRow[] = pageEmployees.map(toRow);
  const kpi = computeEmployeeKpis(kpiSource);

  return (
    <EntityListShell
      title={t('hrm.payroll.employees.title')}
      subtitle={t('hrm.payroll.employees.subtitle')}
    >
      <EmployeesListClient
        rows={rows}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        kpi={kpi}
        currentUserId={session?.user?._id ? String(session.user._id) : null}
        error={error}
      />
    </EntityListShell>
  );
}
