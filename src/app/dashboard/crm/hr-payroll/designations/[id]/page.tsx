import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, Pencil, ArrowLeft } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getDesignation } from '@/app/actions/crm/departments.actions';

export const dynamic = 'force-dynamic';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">{label}</div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

export default async function DesignationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { item, error } = await getDesignation(id);

  if (!item) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">Couldn&apos;t load this designation — {error}</p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/hr-payroll/designations">
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
        subtitle={item.grade || item.code || 'Designation'}
        icon={BadgeCheck}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/hr-payroll/designations">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/hr-payroll/designations/${id}/edit`}>
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
          <Field label="Department">
            {item.departmentId ? <EntityPickerChip entity="department" id={item.departmentId} /> : '—'}
          </Field>
          <Field label="Reports to">
            {item.reportsToDesignationId ? <EntityPickerChip entity="designation" id={item.reportsToDesignationId} /> : '—'}
          </Field>
          <Field label="Level">{item.level != null ? `L${item.level}` : '—'}</Field>
          <Field label="Grade">{item.grade || '—'}</Field>
          <Field label="Min CTC">{item.minCtc != null ? item.minCtc.toLocaleString() : '—'}</Field>
          <Field label="Max CTC">{item.maxCtc != null ? item.maxCtc.toLocaleString() : '—'}</Field>
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
