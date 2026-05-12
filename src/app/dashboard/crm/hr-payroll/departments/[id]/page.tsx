import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Building2, Pencil, ArrowLeft } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getDepartment } from '@/app/actions/crm/departments.actions';

export const dynamic = 'force-dynamic';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">{label}</div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { item, error } = await getDepartment(id);

  if (!item) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">Couldn&apos;t load this department — {error}</p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/hr-payroll/departments">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={item.name}
        subtitle={item.code || 'Department'}
        icon={Building2}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/hr-payroll/departments">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/hr-payroll/departments/${id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </ZoruButton>
          </>
        }
      />

      <ZoruCard className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name">{item.name}</Field>
          <Field label="Code">{item.code || '—'}</Field>
          <Field label="Parent department">
            {item.parentDepartmentId ? <EntityPickerChip entity="department" id={item.parentDepartmentId} /> : '—'}
          </Field>
          <Field label="Head">
            {item.headId ? <EntityPickerChip entity="employee" id={item.headId} /> : '—'}
          </Field>
          <Field label="Cost center">{item.costCenter || '—'}</Field>
          <Field label="Color">{item.color || '—'}</Field>
          <Field label="Status">
            <ZoruBadge variant={item.active === false ? 'ghost' : 'success'}>
              {item.active === false ? 'Inactive' : 'Active'}
            </ZoruBadge>
          </Field>
          <Field label="Description">{item.description || '—'}</Field>
        </div>
      </ZoruCard>
    </div>
  );
}
