/**
 * Employee activity — `/dashboard/hrm/payroll/employees/[employeeId]/activity`.
 *
 * Mirrors the CRM convention: a dedicated route that renders the audit
 * timeline under the shared `<EntityDetailShell>` so the breadcrumb and
 * back link stay consistent with the rest of the §1D experience.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getEmployee } from '@/app/actions/crm/employees.actions';

interface PageProps {
  params: Promise<{ employeeId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function EmployeeActivityPage({ params }: PageProps) {
  const { employeeId } = await params;
  const { employee } = await getEmployee(employeeId);
  if (!employee) notFound();

  const fullName =
    employee.displayName ||
    [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
    employee.workEmail ||
    'Employee';

  return (
    <EntityDetailShell
      title={fullName}
      eyebrow="EMPLOYEE ACTIVITY"
      back={{
        href: `/dashboard/hrm/payroll/employees/${employeeId}`,
        label: 'Back to employee',
      }}
    >
      <EntityAuditTimeline entityKind="employee" entityId={employeeId} />
    </EntityDetailShell>
  );
}
