/**
 * Employee detail — `/dashboard/crm/hr-payroll/employees/[id]`.
 *
 * Server component: hydrates the employee via the Rust client, resolves
 * relational fields through `<EntityPickerChip>`, and renders the
 * custom-field bag alongside the standard fields. Edit and Delete
 * actions live on this page; the delete dialog is on the list page.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Users, Pencil, ArrowLeft } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruBadge,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
import { getEmployee } from '@/app/actions/crm/employees.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import type { CrmEmployeeStatus } from '@/lib/rust-client/crm-employees';

export const dynamic = 'force-dynamic';

function fmtMoney(value?: number, currency: string = 'INR'): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

function statusBadge(status?: CrmEmployeeStatus | string) {
  if (!status) return '—';
  const map: Record<
    string,
    { label: string; variant: 'outline' | 'success' | 'danger' | 'warning' | 'secondary' }
  > = {
    active: { label: 'Active', variant: 'success' },
    on_leave: { label: 'On leave', variant: 'warning' },
    terminated: { label: 'Terminated', variant: 'danger' },
    resigned: { label: 'Resigned', variant: 'outline' },
  };
  const hit = map[status];
  return <ZoruBadge variant={hit?.variant ?? 'outline'}>{hit?.label ?? status}</ZoruBadge>;
}

function employmentTypeLabel(t?: string): string {
  if (!t) return '—';
  const map: Record<string, string> = {
    full_time: 'Full-time',
    part_time: 'Part-time',
    contract: 'Contract',
    intern: 'Intern',
    consultant: 'Consultant',
  };
  return map[t] ?? t;
}

function genderLabel(g?: string): string {
  if (!g) return '—';
  const map: Record<string, string> = {
    male: 'Male',
    female: 'Female',
    non_binary: 'Non-binary',
    other: 'Other',
    prefer_not_to_say: 'Prefer not to say',
  };
  return map[g] ?? g;
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ employee, error }, customFields] = await Promise.all([
    getEmployee(id),
    getCustomFieldsFor('employee') as Promise<WsCustomField[]>,
  ]);

  if (!employee) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this employee — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/hr-payroll/employees">
              <ArrowLeft className="h-4 w-4" /> Back to Employees
            </Link>
          </ZoruButton>
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
  const cfValues = (employee.customFields ?? {}) as Record<string, unknown>;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={fullName}
        subtitle={employee.employeeId ? `Code · ${employee.employeeId}` : 'Employee'}
        icon={Users}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/hr-payroll/employees">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/hr-payroll/employees/${id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </ZoruButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <ZoruCard className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Identity & Contact
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name">{fullName}</Field>
            <Field label="Employee code">{employee.employeeId || '—'}</Field>
            <Field label="Work email">{employee.workEmail || '—'}</Field>
            <Field label="Work phone">{employee.workPhone || '—'}</Field>
            <Field label="Personal email">{employee.personalEmail || '—'}</Field>
            <Field label="Personal phone">{employee.personalPhone || '—'}</Field>
          </div>

          <h3 className="mb-4 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Organization
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Department">
              {employee.departmentId ? (
                <EntityPickerChip entity="department" id={employee.departmentId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Designation">
              {employee.designationId ? (
                <EntityPickerChip entity="designation" id={employee.designationId} />
              ) : (
                employee.designation || '—'
              )}
            </Field>
            <Field label="Reporting manager">
              {employee.reportingManagerId ? (
                <EntityPickerChip entity="employee" id={employee.reportingManagerId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Dotted-line manager">
              {employee.dottedLineManagerId ? (
                <EntityPickerChip entity="employee" id={employee.dottedLineManagerId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Work location">{employee.workLocation || '—'}</Field>
            <Field label="Assigned to">
              {employee.assignedTo ? (
                <EntityPickerChip entity="user" id={employee.assignedTo} />
              ) : (
                '—'
              )}
            </Field>
          </div>

          <h3 className="mb-4 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Personal
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Date of birth">{fmtDate(employee.dob)}</Field>
            <Field label="Gender">{genderLabel(employee.gender)}</Field>
            <Field label="Nationality">{employee.nationality || '—'}</Field>
            <Field label="Blood group">{employee.bloodGroup || '—'}</Field>
            <Field label="Country">
              {employee.address?.current?.country ? (
                <EntityPickerChip
                  entity="country"
                  id={employee.address.current.country}
                />
              ) : (
                '—'
              )}
            </Field>
            <Field label="City">
              {employee.address?.current?.city ? (
                <EntityPickerChip entity="city" id={employee.address.current.city} />
              ) : (
                '—'
              )}
            </Field>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Employment
          </h3>
          <div className="flex flex-col gap-4">
            <Field label="Status">{statusBadge(employee.status)}</Field>
            <Field label="Employment type">
              {employmentTypeLabel(employee.employmentType)}
            </Field>
            <Field label="Joining date">{fmtDate(employee.joiningDate)}</Field>
            <Field label="Confirmation date">{fmtDate(employee.confirmationDate)}</Field>
            <Field label="Probation end">{fmtDate(employee.probationEnd)}</Field>
            <Field label="CTC">{fmtMoney(employee.ctc)}</Field>
            <Field label="Variable pay">
              {typeof employee.variablePct === 'number' ? `${employee.variablePct}%` : '—'}
            </Field>
            <Field label="Notice period">
              {typeof employee.noticePeriodDays === 'number'
                ? `${employee.noticePeriodDays} days`
                : '—'}
            </Field>
            {employee.exitDate ? (
              <Field label="Exit date">{fmtDate(employee.exitDate)}</Field>
            ) : null}
            {employee.exitReason ? (
              <Field label="Exit reason">{employee.exitReason}</Field>
            ) : null}
          </div>
        </ZoruCard>
      </div>

      {customFields.length > 0 ? (
        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Custom fields
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {customFields.map((f) => (
              <Field key={String(f._id ?? f.name)} label={f.label || f.name}>
                <CustomFieldDisplay
                  field={f}
                  value={cfValues[f.name] as Parameters<typeof CustomFieldDisplay>[0]['value']}
                />
              </Field>
            ))}
          </div>
        </ZoruCard>
      ) : null}

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(employee.createdAt)} · Updated {fmtDate(employee.updatedAt)}
      </div>
    </div>
  );
}
