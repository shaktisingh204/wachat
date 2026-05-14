/**
 * Attendance detail — `/dashboard/hrm/payroll/attendance/[id]` (canonical).
 *
 * Server component: hydrates the record via the Rust client and
 * resolves relational fields through `<EntityPickerChip>`. Uses
 * `<EntityDetailShell>` to render header + sectioned body cards +
 * activity timeline. Edit / Back actions live in the header.
 *
 * §1D rebuild additions:
 *   - Late-by / Early-out badges with the computed delta
 *   - Punch-location chip + "View on Google Maps" deep-link (no
 *     embedded map per the scope cap)
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Pencil } from 'lucide-react';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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

const STATUS_TONE: Record<
  CrmAttendanceStatus,
  'green' | 'red' | 'amber' | 'blue' | 'neutral'
> = {
  present: 'green',
  absent: 'red',
  half_day: 'amber',
  leave: 'blue',
  holiday: 'neutral',
  wfh: 'green',
};

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
            <Link href="/dashboard/hrm/payroll/attendance">
              <ArrowLeft className="h-4 w-4" /> Back to Attendance
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const lateBy = record.lateByMinutes ?? 0;
  const earlyOut = record.earlyOutByMinutes ?? 0;
  const lat = record.punchIn?.lat;
  const lng = record.punchIn?.lng;
  const hasLocation = typeof lat === 'number' && typeof lng === 'number';
  const mapsUrl = hasLocation
    ? `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`
    : null;

  return (
    <EntityDetailShell
      eyebrow="Attendance"
      title={fmtDate(record.date)}
      status={{
        label: STATUS_LABEL[record.status],
        tone: STATUS_TONE[record.status],
      }}
      back={{ href: '/dashboard/hrm/payroll/attendance', label: 'Attendance' }}
      actions={
        <ZoruButton asChild>
          <Link href={`/dashboard/hrm/payroll/attendance/${id}/edit`}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        </ZoruButton>
      }
      audit={{ entityKind: 'attendance', entityId: id }}
      rightRail={
        <ZoruCard className="p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Approver
          </h3>
          <div className="text-[13px] text-zoru-ink">
            {record.approverId ? (
              <EntityPickerChip entity="user" id={record.approverId} />
            ) : (
              '—'
            )}
          </div>
          <h3 className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Source
          </h3>
          <ZoruBadge variant="outline">{record.source}</ZoruBadge>
          <h3 className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Punch-in location
          </h3>
          {hasLocation ? (
            <div className="space-y-2 text-[12px] text-zoru-ink">
              <p className="font-mono">
                {(lat as number).toFixed(5)}, {(lng as number).toFixed(5)}
              </p>
              <ZoruButton variant="outline" size="sm" asChild>
                <a
                  href={mapsUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View on Google Maps
                </a>
              </ZoruButton>
            </div>
          ) : (
            <p className="text-[12px] text-zoru-ink-muted">
              No location captured for this punch.
            </p>
          )}
        </ZoruCard>
      }
    >
      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Header
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Employee">
            <EntityPickerChip entity="employee" id={record.employeeId} />
          </Field>
          <Field label="Date">{fmtDate(record.date)}</Field>
          <Field label="Status">
            <ZoruBadge>{STATUS_LABEL[record.status]}</ZoruBadge>
          </Field>
          <Field label="Shift">
            {record.shiftId ? (
              <span className="font-mono text-[12px] text-zoru-ink-muted">
                {record.shiftId}
              </span>
            ) : (
              '—'
            )}
          </Field>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Times
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Check-in">{fmtDateTime(record.punchIn?.at)}</Field>
          <Field label="Check-out">{fmtDateTime(record.punchOut?.at)}</Field>
          <Field label="Total hours">{fmtHours(record.totalHours)}</Field>
          <Field label="Overtime hours">{fmtHours(record.overtimeHours)}</Field>
          <Field label="Late by">
            <span className="inline-flex items-center gap-2">
              {fmtMinutes(record.lateByMinutes)}
              {lateBy > 0 ? (
                <ZoruBadge variant="warning">+{lateBy}m late</ZoruBadge>
              ) : null}
            </span>
          </Field>
          <Field label="Early-out by">
            <span className="inline-flex items-center gap-2">
              {fmtMinutes(record.earlyOutByMinutes)}
              {earlyOut > 0 ? (
                <ZoruBadge variant="warning">−{earlyOut}m early</ZoruBadge>
              ) : null}
            </span>
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
    </EntityDetailShell>
  );
}
