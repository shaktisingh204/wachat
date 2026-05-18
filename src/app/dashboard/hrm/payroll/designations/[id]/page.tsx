import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { Pencil,
  ArrowLeft } from 'lucide-react';

/**
 * Designation detail — `/dashboard/hrm/payroll/designations/[id]` (canonical).
 *
 * Server component. Renders the designation via `<EntityDetailShell>`
 * with a right-rail showing the count of employees holding this role.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getDesignation } from '@/app/actions/crm/departments.actions';
import { listEmployees } from '@/app/actions/crm/employees.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
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
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this designation — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/hrm/payroll/designations">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const { employees = [] } = await listEmployees({
    designationId: id,
    limit: 100,
  });

  return (
    <EntityDetailShell
      eyebrow="Designation"
      title={item.name}
      status={{
        label: item.active === false ? 'Inactive' : 'Active',
        tone: item.active === false ? 'neutral' : 'green',
      }}
      back={{
        href: '/dashboard/hrm/payroll/designations',
        label: 'Designations',
      }}
      actions={
        <ZoruButton asChild>
          <Link href={`/dashboard/hrm/payroll/designations/${id}/edit`}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        </ZoruButton>
      }
      audit={<EntityAuditTimeline entityKind="designation" entityId={id} />}
      rightRail={
        <ZoruCard className="p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Holders
          </h3>
          <div className="text-[24px] font-semibold tabular-nums text-zoru-ink">
            {employees.length}
          </div>
          <p className="mt-1 text-[12px] text-zoru-ink-muted">
            Employee{employees.length === 1 ? '' : 's'} currently in this role.
          </p>
        </ZoruCard>
      }
    >
      <ZoruCard className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name">{item.name}</Field>
          <Field label="Code">{item.code || '—'}</Field>
          <Field label="Department">
            {item.departmentId ? (
              <EntityPickerChip entity="department" id={item.departmentId} />
            ) : (
              '—'
            )}
          </Field>
          <Field label="Reports to">
            {item.reportsToDesignationId ? (
              <EntityPickerChip
                entity="designation"
                id={item.reportsToDesignationId}
              />
            ) : (
              '—'
            )}
          </Field>
          <Field label="Level">
            {item.level != null ? `L${item.level}` : '—'}
          </Field>
          <Field label="Grade">{item.grade || '—'}</Field>
          <Field label="Min CTC">
            {item.minCtc != null ? item.minCtc.toLocaleString() : '—'}
          </Field>
          <Field label="Max CTC">
            {item.maxCtc != null ? item.maxCtc.toLocaleString() : '—'}
          </Field>
          <Field label="Color">
            {item.color ? (
              <ZoruBadge variant="outline">{item.color}</ZoruBadge>
            ) : (
              '—'
            )}
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">{item.description || '—'}</Field>
          </div>
        </div>
      </ZoruCard>
    </EntityDetailShell>
  );
}
