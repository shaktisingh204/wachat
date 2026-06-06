import { Button, Card } from '@/components/sabcrm/20ui/compat';
import {
  notFound } from 'next/navigation';
import {
  ArrowLeft,
  PenLine,
  PlaneTakeoff,
  StickyNote,
  ListChecks,
  CalendarCheck,
  FileText,
  Package,
  Banknote,
  } from 'lucide-react';

/**
 * Employee detail — `/dashboard/hrm/payroll/employees/[employeeId]`.
 *
 * Server component: hydrates the employee via the Rust client and
 * resolves relational fields through `<EntityPickerChip>`. Uses
 * `<EntityDetailShell>` to render header + sectioned body cards +
 * audit timeline.
 *
 * Detail body (per §1D rebuild plan, scope-capped):
 *   1. Overview — Personal + Identity + Employment + Compensation +
 *      Custom fields
 *   2. Attendance — last 30 days summary + recent punches
 *   3. Leave — recent leave applications
 *   4. Payslips — link to payslip module (deferred for inline render —
 *      Rust DTO doesn't list `payslip` here yet)
 *
 * Right rail:
 *   - Reporting tree (manager + direct reports — shown via picker chips)
 *   - Quick actions (Add leave, Punch in, Add note)
 *   - Tags + Assigned-to
 *
 * Header actions live in `<EmployeeDetailActions>` (Edit · Mark on
 * leave · Terminate · Welcome kit · More dropdown). The status pill
 * dropdown swaps the active status via `updateEmployee`.
 *
 * TODO §1D.10 — Documents / Performance / Assets sections deferred.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { RelatedRail } from '@/components/crm/RelatedRail';
import {
  getEmployee,
  getCrmEmployeeRelatedCounts,
} from '@/app/actions/crm/employees.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { crmEmployeesApi } from '@/lib/rust-client/crm-employees';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import type { CrmEmployeeStatus } from '@/lib/rust-client/crm-employees';

import { EmployeeDetailActions } from '../_components/employee-detail-actions';
import { EmployeeDetailSections } from '../_components/employee-detail-sections';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<
  CrmEmployeeStatus,
  'green' | 'amber' | 'red' | 'blue' | 'neutral'
> = {
  active: 'green',
  on_leave: 'amber',
  terminated: 'red',
  resigned: 'neutral',
};

const STATUS_LABEL: Record<CrmEmployeeStatus, string> = {
  active: 'Active',
  on_leave: 'On leave',
  terminated: 'Terminated',
  resigned: 'Resigned',
};

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const [{ employee, error }, customFields, relatedCounts] = await Promise.all([
    getEmployee(employeeId),
    getCustomFieldsFor('employee') as Promise<WsCustomField[]>,
    getCrmEmployeeRelatedCounts(employeeId),
  ]);

  if (!employee) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-[var(--st-text)]">
            Couldn&apos;t load this employee — {error}
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/hrm/payroll/employees">
              <ArrowLeft className="h-4 w-4" /> Back to Employees
            </Link>
          </Button>
        </div>
      );
    }
    notFound();
  }

  const fullName =
    employee.displayName ||
    [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
    employee.workEmail ||
    'Employee';
  const status = employee.status as CrmEmployeeStatus | undefined;

  // Fetch direct reports for the right-rail tree (best-effort).
  const directReports = await crmEmployeesApi
    .list({ limit: 50 })
    .then((all) =>
      all.filter((e) => e.reportingManagerId === employeeId),
    )
    .catch(() => [] as Awaited<ReturnType<typeof crmEmployeesApi.list>>);

  return (
    <EntityDetailShell
      eyebrow={employee.employeeId ? `Code · ${employee.employeeId}` : 'Employee'}
      title={fullName}
      status={
        status
          ? { label: STATUS_LABEL[status] ?? status, tone: STATUS_TONE[status] ?? 'neutral' }
          : undefined
      }
      back={{ href: '/dashboard/hrm/payroll/employees', label: 'Employees' }}
      actions={
        <EmployeeDetailActions
          employeeId={employeeId}
          status={status}
        />
      }
      audit={<EntityAuditTimeline entityKind="employee" entityId={employeeId} />}
      rightRail={
        <>
          <Card className="p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              Reporting tree
            </h3>
            <div className="space-y-3 text-[12.5px] text-[var(--st-text)]">
              <div>
                <div className="text-[11px] text-[var(--st-text-secondary)]">Manager</div>
                <div className="mt-1">
                  {employee.reportingManagerId ? (
                    <EntityPickerChip
                      entity="employee"
                      id={employee.reportingManagerId}
                    />
                  ) : (
                    <span className="text-[var(--st-text-secondary)]">—</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--st-text-secondary)]">
                  Direct reports
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {directReports.length === 0 ? (
                    <span className="text-[var(--st-text-secondary)]">—</span>
                  ) : (
                    directReports.map((r) => (
                      <EntityPickerChip
                        key={String(r._id)}
                        entity="employee"
                        id={String(r._id)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              Quick actions
            </h3>
            <div className="flex flex-col gap-1.5">
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/dashboard/crm/hr-payroll/leave/new?employeeId=${employeeId}`}
                >
                  <PlaneTakeoff className="h-3.5 w-3.5" /> Add leave
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/dashboard/hrm/payroll/attendance/new?employeeId=${employeeId}`}
                >
                  <PenLine className="h-3.5 w-3.5" /> Punch in / out
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/dashboard/hrm/payroll/employees/${employeeId}/edit#notes`}
                >
                  <StickyNote className="h-3.5 w-3.5" /> Add note
                </Link>
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              Assigned to
            </h3>
            <div className="text-[12.5px] text-[var(--st-text)]">
              {employee.assignedTo ? (
                <EntityPickerChip entity="user" id={employee.assignedTo} />
              ) : (
                '—'
              )}
            </div>
            <h3 className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              Tags
            </h3>
            <div className="flex flex-wrap gap-1">
              {(employee.tags ?? []).length === 0 ? (
                <span className="text-[12px] text-[var(--st-text-secondary)]">—</span>
              ) : (
                (employee.tags ?? []).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-[var(--st-bg-secondary)] px-2 py-0.5 text-[11px] text-[var(--st-text)]"
                  >
                    {t}
                  </span>
                ))
              )}
            </div>
          </Card>

          <RelatedRail
            items={[
              {
                label: 'Tasks',
                count: relatedCounts.tasks,
                icon: <ListChecks className="h-3.5 w-3.5" />,
                href: `/dashboard/crm/tasks?employeeId=${employeeId}`,
              },
              {
                label: 'Leaves',
                count: relatedCounts.leaves,
                icon: <PlaneTakeoff className="h-3.5 w-3.5" />,
                href: `/dashboard/crm/hr-payroll/leave?employeeId=${employeeId}`,
              },
              {
                label: 'Attendance',
                count: relatedCounts.attendance,
                icon: <CalendarCheck className="h-3.5 w-3.5" />,
                href: `/dashboard/crm/hr-payroll/attendance?employeeId=${employeeId}`,
              },
              {
                label: 'Documents',
                count: relatedCounts.documents,
                icon: <FileText className="h-3.5 w-3.5" />,
                href: `/dashboard/crm/hr/documents?employeeId=${employeeId}`,
              },
              {
                label: 'Assets',
                count: relatedCounts.assets,
                icon: <Package className="h-3.5 w-3.5" />,
                href: `/dashboard/crm/hr/asset-assignments?employeeId=${employeeId}`,
              },
              {
                label: 'Payslips',
                count: relatedCounts.payslips,
                icon: <Banknote className="h-3.5 w-3.5" />,
                href: `/dashboard/crm/hr-payroll/payslips?employeeId=${employeeId}`,
              },
            ]}
          />
        </>
      }
    >
      <EmployeeDetailSections
        employee={employee}
        customFields={customFields}
      />
    </EntityDetailShell>
  );
}
