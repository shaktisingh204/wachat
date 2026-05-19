import { notFound } from 'next/navigation';

/**
 * Timesheet detail — `/dashboard/crm/hr/timesheets/[id]`.
 *
 * Server component matching the canonical `<EntityDetailShell>`
 * pattern from `bookings/[id]/page.tsx` (§3.4 of CRM_PAGE_REDESIGN_PLAN):
 *   - Header: status pill, eyebrow, title, action menu
 *     (Submit / Approve / Reject / Edit / Delete).
 *   - Main: Overview · Daily entries · Project breakdown · Notes.
 *   - Right rail: Employee chip · Hours summary · Approval state.
 *   - Footer: <EntityAuditTimeline entityKind="timesheet" />.
 */

import {
    ZoruBadge,
    ZoruCard,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui';

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

import {
    getCrmTimesheetById,
    type CrmTimesheetStatus,
} from '@/app/actions/crm-timesheets.actions';

import { TimesheetDetailActions } from '../_components/timesheet-detail-actions';

export const dynamic = 'force-dynamic';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function statusTone(status: CrmTimesheetStatus): EntityStatusTone {
    switch (status) {
        case 'approved':
            return 'green';
        case 'submitted':
            return 'amber';
        case 'rejected':
            return 'red';
        case 'archived':
        case 'draft':
        default:
            return 'neutral';
    }
}

function fmtDate(v?: string): string {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtDateTime(v?: string): string {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
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

export default async function TimesheetDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const doc = await getCrmTimesheetById(id);
    if (!doc) notFound();

    const status = doc.status;
    const title = `Timesheet — ${doc.employeeName || 'Employee'}`;
    const subtitle = `${fmtDate(doc.weekStartDate)} → ${fmtDate(doc.weekEndDate)}`;
    const totalHours = doc.totalHours ?? doc.dailyHours.reduce((a, b) => a + b, 0);
    const projectHours = (doc.projectBreakdowns ?? []).reduce(
        (a, b) => a + (Number.isFinite(b.hours) ? b.hours : 0),
        0,
    );

    return (
        <EntityDetailShell
            title={title}
            eyebrow={`TIMESHEET · ${subtitle}`}
            status={{ label: status, tone: statusTone(status) }}
            back={{ href: '/dashboard/crm/hr/timesheets', label: 'Back to Timesheets' }}
            actions={<TimesheetDetailActions id={doc._id} status={status} />}
            audit={<EntityAuditTimeline entityKind="timesheet" entityId={doc._id} />}
            rightRail={
                <>
                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Employee</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            {doc.employeeId ? (
                                <EntityPickerChip entity="employee" id={doc.employeeId} />
                            ) : (
                                <span className="text-[12.5px] text-zoru-ink-muted">
                                    {doc.employeeName || 'No employee'}
                                </span>
                            )}
                        </ZoruCardContent>
                    </ZoruCard>

                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Hours summary</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div className="flex justify-between">
                                    <span className="text-zoru-ink-muted">Total</span>
                                    <span>{totalHours.toFixed(2)} h</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zoru-ink-muted">Projects</span>
                                    <span>{projectHours.toFixed(2)} h</span>
                                </div>
                                <div className="flex justify-between border-t border-zoru-line pt-1.5">
                                    <span className="text-zoru-ink-muted">Unallocated</span>
                                    <span>{Math.max(0, totalHours - projectHours).toFixed(2)} h</span>
                                </div>
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>

                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Approval</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-zoru-ink-muted">Status</span>
                                    <ZoruBadge variant="outline">{status}</ZoruBadge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zoru-ink-muted">Approver</span>
                                    <span>
                                        {doc.approverId ? (
                                            <EntityPickerChip entity="user" id={doc.approverId} />
                                        ) : (
                                            '—'
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zoru-ink-muted">Approved at</span>
                                    <span>{fmtDateTime(doc.approvedAt)}</span>
                                </div>
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>
                </>
            }
        >
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Overview</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Employee">{doc.employeeName || '—'}</Field>
                        <Field label="Week of">
                            {fmtDate(doc.weekStartDate)} → {fmtDate(doc.weekEndDate)}
                        </Field>
                        <Field label="Total hours">{totalHours.toFixed(2)}</Field>
                        <Field label="Status">
                            <ZoruBadge variant="outline">{status}</ZoruBadge>
                        </Field>
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Daily entries</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid grid-cols-7 gap-2 text-center text-[12.5px]">
                        {DAY_LABELS.map((label, i) => {
                            const hours = doc.dailyHours[i] ?? 0;
                            return (
                                <div
                                    key={label}
                                    className="rounded-md border border-zoru-line px-2 py-3"
                                >
                                    <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                                        {label}
                                    </div>
                                    <div className="mt-1 text-[14px] font-medium text-zoru-ink">
                                        {hours.toFixed(2)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            {doc.projectBreakdowns && doc.projectBreakdowns.length > 0 ? (
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Project breakdown</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <ul className="divide-y divide-zoru-line text-[13px]">
                            {doc.projectBreakdowns.map((row, i) => (
                                <li
                                    key={`${row.projectId}-${i}`}
                                    className="flex items-center justify-between py-2"
                                >
                                    <EntityPickerChip entity="project" id={row.projectId} />
                                    <span className="text-zoru-ink">
                                        {row.hours.toFixed(2)} h
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </ZoruCardContent>
                </ZoruCard>
            ) : null}

            {doc.notes ? (
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Notes</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
                            {doc.notes}
                        </p>
                    </ZoruCardContent>
                </ZoruCard>
            ) : null}

            <p className="text-[11px] text-zoru-ink-muted">
                Created {fmtDate(doc.createdAt)} · Updated {fmtDate(doc.updatedAt)}
            </p>
        </EntityDetailShell>
    );
}
