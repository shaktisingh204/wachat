/**
 * Employee detail — `/dashboard/hrm/payroll/employees/[employeeId]` (canonical).
 *
 * Server component: hydrates the employee via the Rust client and
 * resolves relational fields through `<EntityPickerChip>`. Uses
 * `<EntityDetailShell>` to render header + sectioned body cards.
 *
 * Sections (mirrors EMP1 spec): Personal · Identity & Contact ·
 * Address · Employment · Compensation · Custom fields. Bank-account
 * fields are not exposed on `CrmEmployeeDoc` today — section skipped.
 * TODO 1D.10: surface Bank section once `bankAccount.*` lands on the
 * Rust DTO.
 *
 * Header actions: Edit · Activity (in-page audit timeline) · Archive
 * (stubbed link to legacy archive flow — TODO 1D.10).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Archive, Pencil, ArrowLeft } from 'lucide-react';

import { ZoruButton, ZoruCard } from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

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

const STATUS_TONE: Record<
  CrmEmployeeStatus,
  'green' | 'amber' | 'red' | 'blue' | 'neutral'
> = {
  active: 'green',
  on_leave: 'amber',
  terminated: 'red',
  resigned: 'neutral',
};

const STATUS_LABEL: Record<CrmEmployeeStatus, string> = {
  active: 'Active',
  on_leave: 'On leave',
  terminated: 'Terminated',
  resigned: 'Resigned',
};

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
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const [{ employee, error }, customFields] = await Promise.all([
    getEmployee(employeeId),
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
            <Link href="/dashboard/hrm/payroll/employees">
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
  const status = employee.status as CrmEmployeeStatus | undefined;

  return (
    <EntityDetailShell
      eyebrow={employee.employeeId ? `Code · ${employee.employeeId}` : 'Employee'}
      title={fullName}
      status={
        status
          ? { label: STATUS_LABEL[status] ?? status, tone: STATUS_TONE[status] ?? 'neutral' }
          : undefined
      }
      back={{ href: '/dashboard/hrm/payroll/employees', label: 'Employees' }}
      actions={
        <>
          <ZoruButton asChild>
            <Link href={`/dashboard/hrm/payroll/employees/${employeeId}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </ZoruButton>
          <ZoruButton variant="outline" disabled title="Archive coming soon">
            <Archive className="h-4 w-4" /> Archive
          </ZoruButton>
        </>
      }
      audit={{ entityKind: 'employee', entityId: employeeId }}
      rightRail={
        <ZoruCard className="p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Assigned to
          </h3>
          <div className="text-[13px] text-zoru-ink">
            {employee.assignedTo ? (
              <EntityPickerChip entity="user" id={employee.assignedTo} />
            ) : (
              '—'
            )}
          </div>
          <h3 className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Tags
          </h3>
          <div className="flex flex-wrap gap-1">
            {(employee.tags ?? []).length === 0 ? (
              <span className="text-[12px] text-zoru-ink-muted">—</span>
            ) : (
              (employee.tags ?? []).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-zoru-surface px-2 py-0.5 text-[11px] text-zoru-ink"
                >
                  {t}
                </span>
              ))
            )}
          </div>
        </ZoruCard>
      }
    >
      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Personal
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full name">{fullName}</Field>
          <Field label="Salutation">{employee.salutation || '—'}</Field>
          <Field label="Date of birth">{fmtDate(employee.dob)}</Field>
          <Field label="Gender">{genderLabel(employee.gender)}</Field>
          <Field label="Marital status">{employee.maritalStatus || '—'}</Field>
          <Field label="Blood group">{employee.bloodGroup || '—'}</Field>
          <Field label="Nationality">{employee.nationality || '—'}</Field>
          <Field label="Languages">
            {employee.languages && employee.languages.length > 0
              ? employee.languages.join(', ')
              : '—'}
          </Field>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Identity & contact
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Employee code">{employee.employeeId || '—'}</Field>
          <Field label="Work email">{employee.workEmail || '—'}</Field>
          <Field label="Work phone">{employee.workPhone || '—'}</Field>
          <Field label="Extension">{employee.extension || '—'}</Field>
          <Field label="Personal email">{employee.personalEmail || '—'}</Field>
          <Field label="Personal phone">{employee.personalPhone || '—'}</Field>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Address
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
              Current
            </h4>
            <div className="space-y-2 text-[13px] text-zoru-ink">
              <div>{employee.address?.current?.line1 || '—'}</div>
              {employee.address?.current?.line2 ? (
                <div>{employee.address.current.line2}</div>
              ) : null}
              <div className="text-zoru-ink-muted">
                {[
                  employee.address?.current?.city,
                  employee.address?.current?.state,
                  employee.address?.current?.pinCode,
                ]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </div>
              <div className="text-zoru-ink-muted">
                {employee.address?.current?.country ? (
                  <EntityPickerChip
                    entity="country"
                    id={employee.address.current.country}
                  />
                ) : (
                  '—'
                )}
              </div>
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
              Permanent
            </h4>
            <div className="space-y-2 text-[13px] text-zoru-ink">
              <div>{employee.address?.permanent?.line1 || '—'}</div>
              {employee.address?.permanent?.line2 ? (
                <div>{employee.address.permanent.line2}</div>
              ) : null}
              <div className="text-zoru-ink-muted">
                {[
                  employee.address?.permanent?.city,
                  employee.address?.permanent?.state,
                  employee.address?.permanent?.pinCode,
                ]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </div>
              <div className="text-zoru-ink-muted">
                {employee.address?.permanent?.country ? (
                  <EntityPickerChip
                    entity="country"
                    id={employee.address.permanent.country}
                  />
                ) : (
                  '—'
                )}
              </div>
            </div>
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Employment
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Employment type">
            {employmentTypeLabel(employee.employmentType)}
          </Field>
          <Field label="Joining date">{fmtDate(employee.joiningDate)}</Field>
          <Field label="Confirmation date">
            {fmtDate(employee.confirmationDate)}
          </Field>
          <Field label="Probation end">{fmtDate(employee.probationEnd)}</Field>
          <Field label="Department">
            {employee.departmentId ? (
              <EntityPickerChip entity="department" id={employee.departmentId} />
            ) : (
              '—'
            )}
          </Field>
          <Field label="Designation">
            {employee.designationId ? (
              <EntityPickerChip
                entity="designation"
                id={employee.designationId}
              />
            ) : (
              employee.designation || '—'
            )}
          </Field>
          <Field label="Reporting manager">
            {employee.reportingManagerId ? (
              <EntityPickerChip
                entity="employee"
                id={employee.reportingManagerId}
              />
            ) : (
              '—'
            )}
          </Field>
          <Field label="Dotted-line manager">
            {employee.dottedLineManagerId ? (
              <EntityPickerChip
                entity="employee"
                id={employee.dottedLineManagerId}
              />
            ) : (
              '—'
            )}
          </Field>
          <Field label="Work location">{employee.workLocation || '—'}</Field>
          <Field label="Shift">
            {employee.shiftId ? (
              <span className="font-mono text-[12px] text-zoru-ink-muted">
                {employee.shiftId}
              </span>
            ) : (
              '—'
            )}
          </Field>
          {employee.exitDate ? (
            <>
              <Field label="Exit date">{fmtDate(employee.exitDate)}</Field>
              <Field label="Exit reason">{employee.exitReason || '—'}</Field>
            </>
          ) : null}
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Compensation
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="CTC">{fmtMoney(employee.ctc)}</Field>
          <Field label="Variable pay">
            {typeof employee.variablePct === 'number'
              ? `${employee.variablePct}%`
              : '—'}
          </Field>
          <Field label="Notice period">
            {typeof employee.noticePeriodDays === 'number'
              ? `${employee.noticePeriodDays} days`
              : '—'}
          </Field>
          <Field label="Salary structure">
            {employee.salaryStructureId ? (
              <span className="font-mono text-[12px] text-zoru-ink-muted">
                {employee.salaryStructureId}
              </span>
            ) : (
              '—'
            )}
          </Field>
        </div>
      </ZoruCard>

      {/* TODO 1D.10: Bank section deferred — `bankAccount.*` not yet on CrmEmployeeDoc. */}

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
                  value={
                    cfValues[f.name] as Parameters<
                      typeof CustomFieldDisplay
                    >[0]['value']
                  }
                />
              </Field>
            ))}
          </div>
        </ZoruCard>
      ) : null}

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(employee.createdAt)} · Updated{' '}
        {fmtDate(employee.updatedAt)}
      </div>
    </EntityDetailShell>
  );
}
