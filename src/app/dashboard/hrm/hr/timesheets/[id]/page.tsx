/**
 * Timesheet detail page (§1D.2).
 *
 * Loads a single document from `hr_timesheets` and renders overview
 * grid + a per-day entries table (if `entries` is an array). Actions:
 * Edit · Approve · Reject · Print (stubs).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
    Clock,
    Pencil,
    Check,
    X,
    Printer,
    ArrowLeft,
} from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui';
import { statusToTone } from '@/components/crm/status-pill';
import {
    getHrEntityById,
    fmtDate,
    fmtText,
    fmtNumber,
    fmtShortId,
} from '../../_components/hr-detail-loader';
import { HrDetailGrid, HrDetailRow } from '../../_components/hr-detail-grid';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import {
    submitTimesheet,
    approveTimesheet,
    rejectTimesheet,
} from '@/app/actions/hr-status-flow.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

interface PageProps {
    params: Promise<{ id: string }>;
}

const BASE = '/dashboard/hrm/hr/timesheets';

interface TimesheetEntry {
    date?: string;
    projectId?: string;
    project?: string;
    task?: string;
    hours?: number | string;
    billable?: boolean | string;
    notes?: string;
}

export default async function TimesheetDetailPage({ params }: PageProps) {
    const { id } = await params;
    const ts = await getHrEntityById('hr_timesheets', id);
    if (!ts) notFound();

    const t = ts as Record<string, unknown>;
    const status = String(t.status || 'draft');
    const employeeRef = (t.employeeName as string) || (t.employeeId as string) || '—';
    const entries: TimesheetEntry[] = Array.isArray(t.entries) ? (t.entries as TimesheetEntry[]) : [];

    return (
        <EntityDetailShell
            title={`Timesheet · ${fmtShortId(employeeRef)} · wk ${fmtDate(t.weekStart)}`}
            eyebrow="HR · TIMESHEET"
            back={{ href: BASE, label: 'All timesheets' }}
            status={{ label: status, tone: statusToTone(status) }}
            actions={
                <>
                    <Link href={BASE}>
                        <ZoruButton variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </ZoruButton>
                    </Link>
                    <Link href={`${BASE}/${id}/edit`}>
                        <ZoruButton size="sm">
                            <Pencil className="h-4 w-4" /> Edit
                        </ZoruButton>
                    </Link>
                    <a href={`${BASE}/${id}?print=1`} target="_blank" rel="noopener noreferrer">
                        <ZoruButton variant="outline" size="sm">
                            <Printer className="h-4 w-4" /> Print
                        </ZoruButton>
                    </a>
                    <HrActionButtons
                        actions={[
                            {
                                key: 'submit',
                                kind: 'action',
                                label: 'Submit',
                                icon: <Check className="h-4 w-4" />,
                                onRun: () => submitTimesheet(id),
                            },
                            {
                                key: 'approve',
                                kind: 'action',
                                label: 'Approve',
                                icon: <Check className="h-4 w-4" />,
                                onRun: () => approveTimesheet(id),
                            },
                            {
                                key: 'reject',
                                kind: 'prompt',
                                label: 'Reject',
                                icon: <X className="h-4 w-4" />,
                                variant: 'destructive',
                                promptTitle: 'Reject timesheet',
                                promptDescription: 'Provide a reason for rejection.',
                                submitLabel: 'Reject',
                                fields: [
                                    {
                                        name: 'reason',
                                        label: 'Reason',
                                        type: 'textarea',
                                        required: true,
                                    },
                                ],
                                onRun: (v) => rejectTimesheet(id, v.reason ?? ''),
                            },
                        ]}
                    />
                </>
            }
            audit={<EntityAuditTimeline entityKind="timesheet" entityId={id} />}
        >
            <HrDetailGrid title="Overview">
                <HrDetailRow label="Employee">{fmtText(employeeRef)}</HrDetailRow>
                <HrDetailRow label="Week start">{fmtDate(t.weekStart)}</HrDetailRow>
                <HrDetailRow label="Total hours">{fmtNumber(t.totalHours)}</HrDetailRow>
                <HrDetailRow label="Billable hours">{fmtNumber(t.billableHours)}</HrDetailRow>
                <HrDetailRow label="Status">
                    <ZoruBadge variant={status === 'approved' ? 'success' : 'warning'}>
                        {status}
                    </ZoruBadge>
                </HrDetailRow>
                <HrDetailRow label="Submitted at">{fmtDate(t.submittedAt)}</HrDetailRow>
                <HrDetailRow label="Approved by">{fmtText(t.approvedBy)}</HrDetailRow>
                <HrDetailRow label="Approved at">{fmtDate(t.approvedAt)}</HrDetailRow>
                {t.notes ? (
                    <HrDetailRow label="Notes" fullWidth>
                        {String(t.notes)}
                    </HrDetailRow>
                ) : null}
            </HrDetailGrid>

            <ZoruCard className="p-6">
                <div className="mb-4 text-[15px] font-medium text-zoru-ink">Daily entries</div>
                {entries.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No daily entries logged.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Date</ZoruTableHead>
                                    <ZoruTableHead>Project</ZoruTableHead>
                                    <ZoruTableHead>Task</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Hours</ZoruTableHead>
                                    <ZoruTableHead>Billable</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {entries.map((row, idx) => (
                                    <ZoruTableRow key={idx}>
                                        <ZoruTableCell>{fmtDate(row.date)}</ZoruTableCell>
                                        <ZoruTableCell>
                                            {fmtText(row.project || row.projectId)}
                                        </ZoruTableCell>
                                        <ZoruTableCell>{fmtText(row.task)}</ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            {fmtNumber(row.hours)}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {row.billable === true || row.billable === 'true' || row.billable === 'yes'
                                                ? 'Yes'
                                                : 'No'}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                )}
            </ZoruCard>

            <Clock className="hidden" />
        </EntityDetailShell>
    );
}
