/**
 * Edit department — `/dashboard/hrm/payroll/departments/[id]/edit` (canonical).
 *
 * Hydrates the existing department and passes it to the shared
 * `<DepartmentForm>` (re-used from the Create flow). The form submits
 * a PATCH because `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { DepartmentForm } from '@/app/dashboard/crm/hr-payroll/departments/_components/department-form';
import { getDepartment } from '@/app/actions/crm/departments.actions';

export const dynamic = 'force-dynamic';

export default async function EditDepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { item } = await getDepartment(id);
  if (!item) notFound();

  return (
    <EntityListShell
      title={`Edit ${item.name}`}
      subtitle="Update department."
    >
      <DepartmentForm initial={item} />
    </EntityListShell>
  );
}
