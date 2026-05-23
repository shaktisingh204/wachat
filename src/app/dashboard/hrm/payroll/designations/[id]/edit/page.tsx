/**
 * Edit designation — `/dashboard/hrm/payroll/designations/[id]/edit` (canonical).
 *
 * Hydrates the existing designation and passes it to the shared
 * `<DesignationForm>` (re-used from the Create flow).
 */

import { notFound } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { DesignationForm } from '@/app/dashboard/hrm/payroll/designations/_components/designation-form';
import { getDesignation } from '@/app/actions/crm/departments.actions';

export const dynamic = 'force-dynamic';

export default async function EditDesignationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { item } = await getDesignation(id);
  if (!item) notFound();

  return (
    <EntityListShell
      title={`Edit ${item.name}`}
      subtitle="Update designation."
    >
      <DesignationForm initial={item} />
    </EntityListShell>
  );
}
