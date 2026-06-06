import { Badge, Button, Card } from '@/components/sabcrm/20ui/compat';
import {
  notFound } from 'next/navigation';
import { Pencil,
  ArrowLeft } from 'lucide-react';

/**
 * Department detail — `/dashboard/hrm/payroll/departments/[id]` (canonical).
 *
 * Server component. Renders the department via `<EntityDetailShell>`
 * with a right-rail showing member + child counts (resolved through
 * the same Rust list endpoints used by the directory). Edit / Back
 * actions live in the header.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import {
  getDepartment,
  listDepartments,
} from '@/app/actions/crm/departments.actions';
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
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
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
          <p className="text-[14px] text-[var(--st-text)]">
            Couldn&apos;t load this department — {error}
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/hrm/payroll/departments">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
      );
    }
    notFound();
  }

  // Related counts — best-effort, fall back to 0 on error. The Rust
  // departments list endpoint doesn't expose a parent filter, so we
  // pull a wide page and partition client-side.
  const [{ employees: members = [] }, { items: allDepartments = [] }] =
    await Promise.all([
      listEmployees({ departmentId: id, limit: 100 }),
      listDepartments({ limit: 100 }),
    ]);
  const children = allDepartments.filter((d) => d.parentDepartmentId === id);

  return (
    <EntityDetailShell
      eyebrow="Department"
      title={item.name}
      status={{
        label: item.active === false ? 'Inactive' : 'Active',
        tone: item.active === false ? 'neutral' : 'green',
      }}
      back={{ href: '/dashboard/hrm/payroll/departments', label: 'Departments' }}
      actions={
        <Button asChild>
          <Link href={`/dashboard/hrm/payroll/departments/${id}/edit`}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        </Button>
      }
      audit={<EntityAuditTimeline entityKind="department" entityId={id} />}
      rightRail={
        <>
          <Card className="p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              Related
            </h3>
            <dl className="space-y-2 text-[13px] text-[var(--st-text)]">
              <div className="flex justify-between">
                <dt className="text-[var(--st-text-secondary)]">Members</dt>
                <dd className="tabular-nums">{members.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--st-text-secondary)]">Child departments</dt>
                <dd className="tabular-nums">{children.length}</dd>
              </div>
            </dl>
          </Card>

          {children.length > 0 ? (
            <Card className="p-4">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Child departments
              </h3>
              <ul className="space-y-1.5">
                {children.slice(0, 8).map((c) => (
                  <li key={c._id}>
                    <Link
                      href={`/dashboard/hrm/payroll/departments/${c._id}`}
                      className="text-[13px] text-[var(--st-text)] hover:underline"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      }
    >
      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name">{item.name}</Field>
          <Field label="Code">{item.code || '—'}</Field>
          <Field label="Parent department">
            {item.parentDepartmentId ? (
              <EntityPickerChip
                entity="department"
                id={item.parentDepartmentId}
              />
            ) : (
              '—'
            )}
          </Field>
          <Field label="Head">
            {item.headId ? (
              <EntityPickerChip entity="employee" id={item.headId} />
            ) : (
              '—'
            )}
          </Field>
          <Field label="Cost center">{item.costCenter || '—'}</Field>
          <Field label="Color">
            {item.color ? (
              <Badge variant="outline">{item.color}</Badge>
            ) : (
              '—'
            )}
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">{item.description || '—'}</Field>
          </div>
        </div>
      </Card>
    </EntityDetailShell>
  );
}
