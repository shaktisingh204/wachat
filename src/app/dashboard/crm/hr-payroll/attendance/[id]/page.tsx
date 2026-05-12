/**
 * Attendance detail — `/dashboard/crm/hr-payroll/attendance/[id]`.
 *
 * Server component: hydrates the record via the Rust client and
 * resolves relational fields through `<EntityPickerChip>`. Edit lives
 * on this page; delete is on the list page.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarCheck, Pencil, ArrowLeft } from 'lucide-react';

import { ZoruButton, ZoruCard, ZoruBadge } from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getAttendance } from '@/app/actions/crm/attendance.actions';
import type { CrmAttendanceStatus } from '@/lib/rust-client/crm-attendance';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<CrmAttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half day',
  leave: 'Leave',
  holiday: 'Holiday',
  wfh: 'WFH',
};

const STATUS_VARIANT: Record<
  CrmAttendanceStatus,
  React.ComponentProps<typeof ZoruBadge>['variant']
> = {
  present: 'success',
  absent: 'danger',
  half_day: 'warning',
  leave: 'info',
  holiday: 'secondary',
  wfh: 'success',
};

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtDateTime(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
}

function fmtHours(v?: number): string {
  if (typeof v !== 'number') return '—';
  return `${v.toFixed(2)}h`;
}

function fmtMinutes(v?: number): string {
  if (typeof v !== 'number') return '—';
  return `${v} min`;
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

export default async function AttendanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { record, error } = await getAttendance(id);

  if (!record) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this record — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/hr-payroll/attendance">
              <ArrowLeft className="h-4 w-4" /> Back to Attendance
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
        title={fmtDate(record.date)}
        subtitle="Attendance record"
        icon={CalendarCheck}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/hr-payroll/attendance">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link
                href={`/dashboard/crm/hr-payroll/attendance/${id}/edit`}
              >
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </ZoruButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <ZoruCard className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Header
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Employee">
              <EntityPickerChip entity="employee" id={record.employeeId} />
            </Field>
            <Field label="Date">{fmtDate(record.date)}</Field>
            <Field label="Status">
              <ZoruBadge variant={STATUS_VARIANT[record.status]}>
                {STATUS_LABEL[record.status]}
              </ZoruBadge>
            </Field>
            <Field label="Source">
              <span className="capitalize">{record.source}</span>
            </Field>
            <Field label="Approver">
              {record.approverId ? (
                <EntityPickerChip entity="user" id={record.approverId} />
              ) : (
                '—'
              )}
            </Field>
          </div>

          <h3 className="mb-4 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Times
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Check-in">{fmtDateTime(record.punchIn?.at)}</Field>
            <Field label="Check-out">{fmtDateTime(record.punchOut?.at)}</Field>
            <Field label="Total hours">{fmtHours(record.totalHours)}</Field>
            <Field label="Overtime hours">
              {fmtHours(record.overtimeHours)}
            </Field>
            <Field label="Late by">{fmtMinutes(record.lateByMinutes)}</Field>
            <Field label="Early-out by">
              {fmtMinutes(record.earlyOutByMinutes)}
            </Field>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Notes
          </h3>
          <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
            {record.notes || '—'}
          </p>
        </ZoruCard>
      </div>

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(record.createdAt || record.audit?.createdAt)} ·
        Updated {fmtDate(record.updatedAt || record.audit?.updatedAt)}
      </div>
    </div>
  );
}
