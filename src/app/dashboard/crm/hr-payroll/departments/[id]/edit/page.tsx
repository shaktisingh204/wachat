import { notFound } from 'next/navigation';
import { Building2 } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { DepartmentForm } from '../../_components/department-form';
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader title={`Edit ${item.name}`} subtitle="Update department." icon={Building2} />
      <DepartmentForm initial={item} />
    </div>
  );
}
