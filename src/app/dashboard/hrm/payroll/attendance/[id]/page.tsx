'use client';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  useSearchParams } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Attendance detail — per-row view for one attendance record.
 *
 * Reads via `getCrmAttendance(date)` (the only available getter on the
 * Mongo path) and finds the row by `_id`. The page accepts an optional
 * `?date=YYYY-MM-DD` so deep-linking from the list keeps working; if
 * omitted we fall back to today (the spec only requires that the user
 * can land on a row from the list page, which always passes the date).
 *
 * Status changes are done via the bulk-mark page; this view is read-only.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

import { getCrmAttendance } from '@/app/actions/crm-hr.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';

interface AttendanceRecord {
    _id: string;
    employeeId: string;
    employeeName: string;
    date: string;
    status: string;
    checkIn?: string;
    checkOut?: string;
    notes?: string;
}

function todayIso(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtTime(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime())
        ? '—'
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function statusVariant(s: string): 'success' | 'danger' | 'warning' | 'secondary' {
    if (s === 'Present') return 'success';
    if (s === 'Absent') return 'danger';
    if (s === 'Late' || s === 'Half Day') return 'warning';
    return 'secondary';
}

function FieldRow({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}): React.JSX.Element {
    return (
        <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                {label}
            </dt>
            <dd className="mt-1 text-[13px] text-zoru-ink">{children}</dd>
        </div>
    );
}

export default function AttendanceDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}): React.JSX.Element {
    const { id } = React.use(params);
    const searchParams = useSearchParams();
    const queryDate = searchParams.get('date');

    const [record, setRecord] = React.useState<AttendanceRecord | null>(null);
    const [searchDate, setSearchDate] = React.useState<string>(queryDate || todayIso());
    const [isLoading, startLoad] = React.useTransition();

    React.useEffect(() => {
        startLoad(async () => {
            const tries: string[] = [];
            // Try the URL-hinted date first, then sweep a small window
            // around today so the link still resolves if a stale date
            // hint was passed.
            tries.push(searchDate);
            const today = new Date(searchDate);
            for (let off = 1; off <= 7; off++) {
                const back = new Date(today);
                back.setDate(today.getDate() - off);
                tries.push(back.toISOString().slice(0, 10));
            }

            const empsPromise = getCrmEmployees();

            for (const d of tries) {
                const list = await getCrmAttendance(new Date(d));
                const arr = list as unknown as Array<Record<string, unknown>>;
                const match = arr.find((a) => String(a._id) === id);
                if (match) {
                    const emps = (await empsPromise) as unknown as Array<
                        Record<string, unknown>
                    >;
                    const empId = String(match.employeeId ?? '');
                    const emp = emps.find((e) => String(e._id) === empId);
                    const name = emp
                        ? `${(emp.firstName as string) ?? ''} ${(emp.lastName as string) ?? ''}`.trim() || 'Unnamed'
                        : 'Unknown';
                    setRecord({
                        _id: String(match._id),
                        employeeId: empId,
                        employeeName: name,
                        date: String(match.date),
                        status: String(match.status ?? '—'),
                        checkIn: match.checkIn as string | undefined,
                        checkOut: match.checkOut as string | undefined,
                        notes: match.notes as string | undefined,
                    });
                    return;
                }
            }
            setRecord(null);
        });
    }, [id, searchDate]);

    return (
        <EntityDetailShell
            eyebrow="ATTENDANCE"
            title="Attendance record"
            back={{ href: '/dashboard/hrm/payroll/attendance', label: 'Attendance' }}
            actions={
                <ZoruButton asChild>
                    <Link
                        href={`/dashboard/hrm/payroll/attendance/new?date=${searchDate}`}
                    >
                        <Pencil className="mr-2 h-4 w-4" />
                        Bulk edit for this date
                    </Link>
                </ZoruButton>
            }
        >

            {isLoading && !record ? (
                <ZoruCard className="p-6">
                    <p className="py-10 text-center text-[13px] text-zoru-ink-muted">
                        Loading…
                    </p>
                </ZoruCard>
            ) : !record ? (
                <ZoruCard className="p-6">
                    <p className="py-10 text-center text-[13px] text-zoru-ink-muted">
                        Attendance record not found.
                    </p>
                </ZoruCard>
            ) : (
                <ZoruCard className="p-6">
                    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-[11px] uppercase text-zoru-ink-muted">
                                Employee
                            </div>
                            <div className="mt-1 text-[18px] text-zoru-ink">
                                {record.employeeName}
                            </div>
                        </div>
                        <ZoruBadge variant={statusVariant(record.status)}>
                            {record.status}
                        </ZoruBadge>
                    </div>
                    <dl className="grid gap-4 md:grid-cols-3">
                        <FieldRow label="Date">{fmtDate(record.date)}</FieldRow>
                        <FieldRow label="Check-in">{fmtTime(record.checkIn)}</FieldRow>
                        <FieldRow label="Check-out">{fmtTime(record.checkOut)}</FieldRow>
                        <FieldRow label="Notes">
                            <span className="whitespace-pre-wrap">{record.notes || '—'}</span>
                        </FieldRow>
                    </dl>
                </ZoruCard>
            )}
        </EntityDetailShell>
    );
}
