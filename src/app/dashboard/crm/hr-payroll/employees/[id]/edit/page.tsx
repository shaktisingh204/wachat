/**
 * Edit employee — `/dashboard/crm/hr-payroll/employees/[id]/edit`.
 *
 * Hydrates the existing employee, fetches custom-field definitions, and
 * passes both to the shared `<EmployeeForm>` (re-used from the Create
 * flow). The form submits a PATCH because `_id` is rendered as a hidden
 * input.
 */

import { notFound } from 'next/navigation';
import { Users } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { EmployeeForm } from '../../_components/employee-form';
import { getEmployee } from '@/app/actions/crm/employees.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ employee }, customFields] = await Promise.all([
    getEmployee(id),
    getCustomFieldsFor('employee') as Promise<WsCustomField[]>,
  ]);

  if (!employee) notFound();

  const fullName =
    employee.displayName ||
    [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
    employee.workEmail ||
    'Employee';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${fullName}`}
        subtitle="Update employee details."
        icon={Users}
      />
      <EmployeeForm initial={employee} customFields={customFields} />
    </div>
  );
}
