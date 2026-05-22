import { Badge, Button, Card } from '@/components/zoruui';
import { CalendarCheck, FileText, PlaneTakeoff } from 'lucide-react';

/**
 * <EmployeeDetailSections> — sectioned body for the employee detail
 * page. Per the §1D spec the design originally called for tabs; since
 * the `zoruui` design system intentionally ships no tab primitive, we
 * present the same surface area as stacked sections (Overview,
 * Attendance, Leave, Payslips) with anchored ids so deep-links still
 * work from elsewhere.
 *
 * Scope cap (per the parent task): ship Overview + Attendance + Leave
 * + Payslips. Documents / Performance / Assets are flagged as TODO and
 * intentionally left out of this rebuild.
 *
 * Server component — child sections that need data hydrate it server-
 * side; chips that resolve lookups are client components.
 */

import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
import type {
  CrmEmployeeDoc,
  CrmEmployeeStatus,
} from '@/lib/rust-client/crm-employees';
import { crmAttendanceApi } from '@/lib/rust-client/crm-attendance';
import { crmLeavesApi } from '@/lib/rust-client/crm-leaves';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

interface EmployeeDetailSectionsProps {
  employee: CrmEmployeeDoc;
  customFields: WsCustomField[];
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtDateTime(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

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

function SectionAnchor({ id, label }: { id: string; label: string }) {
  return (
    <h2
      id={id}
      className="scroll-mt-20 text-[14px] font-semibold uppercase tracking-wide text-zoru-ink-muted"
    >
      {label}
    </h2>
  );
}

export async function EmployeeDetailSections({
  employee,
  customFields,
}: EmployeeDetailSectionsProps) {
  const employeeIdStr = String(employee._id);
  const cfValues = (employee.customFields ?? {}) as Record<string, unknown>;
  const status = employee.status as CrmEmployeeStatus | undefined;

  // Hydrate the attendance + leave previews server-side so the section
  // body renders without a client-side spinner. Failures degrade to an
  // empty state — they should never block the page render.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
    .toISOString();
  const [attendance30d, recentLeaves] = await Promise.all([
    crmAttendanceApi
      .list({ employeeId: employeeIdStr, dateFrom: thirtyDaysAgo, limit: 100 })
      .catch(() => []),
    crmLeavesApi
      .list({ employeeId: employeeIdStr, limit: 10 })
      .catch(() => []),
  ]);

  let presentCount = 0;
  let lateCount = 0;
  let totalHours = 0;
  for (const a of attendance30d) {
    if (a.status === 'present' || a.status === 'wfh') presentCount += 1;
    if ((a.lateByMinutes ?? 0) > 0) lateCount += 1;
    if (typeof a.totalHours === 'number') totalHours += a.totalHours;
  }

  return (
    <>
      {/* ── Overview ── */}
      <section className="space-y-4">
        <SectionAnchor id="overview" label="Overview" />
        <Card className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Personal
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name">
              {employee.displayName ||
                [employee.firstName, employee.lastName]
                  .filter(Boolean)
                  .join(' ') ||
                '—'}
            </Field>
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
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Identity &amp; contact
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Employee code">{employee.employeeId || '—'}</Field>
            <Field label="Work email">{employee.workEmail || '—'}</Field>
            <Field label="Work phone">{employee.workPhone || '—'}</Field>
            <Field label="Extension">{employee.extension || '—'}</Field>
            <Field label="Personal email">{employee.personalEmail || '—'}</Field>
            <Field label="Personal phone">{employee.personalPhone || '—'}</Field>
          </div>
        </Card>

        <Card className="p-6">
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
            <Field label="Probation end">
              {fmtDate(employee.probationEnd)}
            </Field>
            <Field label="Department">
              {employee.departmentId ? (
                <EntityPickerChip
                  entity="department"
                  id={employee.departmentId}
                />
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
            {employee.exitDate ? (
              <>
                <Field label="Exit date">{fmtDate(employee.exitDate)}</Field>
                <Field label="Exit reason">{employee.exitReason || '—'}</Field>
              </>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
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
        </Card>

        {customFields.length > 0 ? (
          <Card className="p-6">
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
          </Card>
        ) : null}
      </section>

      {/* ── Attendance ── */}
      <section className="space-y-4">
        <SectionAnchor id="attendance" label="Attendance (last 30 days)" />
        <Card className="p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Present + WFH">{presentCount}</Field>
            <Field label="Late punches">{lateCount}</Field>
            <Field label="Total hours">
              {totalHours > 0 ? totalHours.toFixed(2) : '0'} h
            </Field>
          </div>
          {attendance30d.length === 0 ? (
            <p className="mt-4 text-[12.5px] text-zoru-ink-muted">
              No attendance entries in the last 30 days.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                  <tr>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">In</th>
                    <th className="p-2 text-left">Out</th>
                    <th className="p-2 text-right">Hours</th>
                    <th className="p-2 text-right">Late (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance30d.slice(0, 10).map((a) => (
                    <tr key={String(a._id)} className="border-t border-zoru-line">
                      <td className="p-2 align-middle">
                        <Link
                          href={`/dashboard/hrm/payroll/attendance/${String(a._id)}`}
                          className="text-zoru-ink hover:underline"
                        >
                          {fmtDate(a.date)}
                        </Link>
                      </td>
                      <td className="p-2 align-middle capitalize text-zoru-ink-muted">
                        {a.status.replace(/_/g, ' ')}
                      </td>
                      <td className="p-2 align-middle text-zoru-ink-muted">
                        {fmtDateTime(a.punchIn?.at)}
                      </td>
                      <td className="p-2 align-middle text-zoru-ink-muted">
                        {fmtDateTime(a.punchOut?.at)}
                      </td>
                      <td className="p-2 text-right align-middle text-zoru-ink">
                        {typeof a.totalHours === 'number'
                          ? a.totalHours.toFixed(2)
                          : '—'}
                      </td>
                      <td className="p-2 text-right align-middle text-zoru-ink-muted">
                        {a.lateByMinutes ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/dashboard/hrm/payroll/attendance?employeeId=${employeeIdStr}`}
              >
                <CalendarCheck className="h-3.5 w-3.5" /> View all attendance
              </Link>
            </Button>
          </div>
        </Card>
      </section>

      {/* ── Leave ── */}
      <section className="space-y-4">
        <SectionAnchor id="leave" label="Leave" />
        <Card className="p-6">
          {recentLeaves.length === 0 ? (
            <p className="text-[12.5px] text-zoru-ink-muted">
              No leave applications yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                  <tr>
                    <th className="p-2 text-left">From</th>
                    <th className="p-2 text-left">To</th>
                    <th className="p-2 text-right">Days</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeaves.map((l) => (
                    <tr key={String(l._id)} className="border-t border-zoru-line">
                      <td className="p-2 align-middle text-zoru-ink">
                        {fmtDate(l.from)}
                      </td>
                      <td className="p-2 align-middle text-zoru-ink">
                        {fmtDate(l.to)}
                      </td>
                      <td className="p-2 text-right align-middle text-zoru-ink">
                        {l.days}
                      </td>
                      <td className="p-2 align-middle">
                        <Badge>{l.status}</Badge>
                      </td>
                      <td className="p-2 align-middle text-zoru-ink-muted">
                        {l.reason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/dashboard/crm/hr-payroll/leave?employeeId=${employeeIdStr}`}
              >
                <PlaneTakeoff className="h-3.5 w-3.5" /> View leave history
              </Link>
            </Button>
          </div>
        </Card>
      </section>

      {/* ── Payslips ── */}
      <section className="space-y-4">
        <SectionAnchor id="payslips" label="Payslips" />
        <Card className="p-6">
          <p className="text-[12.5px] text-zoru-ink-muted">
            Recent payslips for this employee.
          </p>
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/dashboard/crm/hr-payroll/payslips?employeeId=${employeeIdStr}`}
              >
                <FileText className="h-3.5 w-3.5" /> View payslips
              </Link>
            </Button>
          </div>
        </Card>
      </section>

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(employee.createdAt)} · Updated{' '}
        {fmtDate(employee.updatedAt)}
        {status ? ` · Status ${status.replace(/_/g, ' ')}` : ''}
      </div>

      {/* TODO §1D.10 — Documents, Performance, and Assets sections are
       *               intentionally deferred; the Rust DTO doesn't surface
       *               them yet and shipping placeholders here would
       *               mislead users. */}
    </>
  );
}
