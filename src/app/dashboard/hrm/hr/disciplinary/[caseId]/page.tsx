import { fmtDate } from '@/lib/utils';
import { Badge, Button, Card } from '@/components/sabcrm/20ui';
import {
  redirect } from 'next/navigation';
import {
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Scale,
  } from 'lucide-react';

/**
 * Disciplinary case detail page.
 *
 * Server component that renders a Card "Case Details" grid for a
 * single disciplinary case from the `crm_disciplinary_cases` collection.
 * Requires an active session; redirects to the list page otherwise or
 * when the case is not found.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import type { EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { getDisciplinaryCaseById } from '@/app/actions/crm-disciplinary.actions';
import { AddHearingDialog } from '../_components/add-hearing-dialog';
import { getSession } from '@/app/actions/user.actions';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import {
    closeDisciplinaryCase,
    escalateDisciplinaryCase,
    appealDisciplinaryCase,
} from '@/app/actions/hr-status-flow.actions';

export const dynamic = 'force-dynamic';



type SeverityVariant = 'danger' | 'warning' | 'ghost' | 'success';
type StatusVariant = 'warning' | 'ghost' | 'success' | 'danger';

const SEVERITY_VARIANT: Record<string, SeverityVariant> = {
    critical: 'danger',
    high: 'warning',
    medium: 'ghost',
    low: 'ghost',
};

const STATUS_VARIANT: Record<string, StatusVariant> = {
    open: 'warning',
    under_review: 'ghost',
    resolved: 'success',
    dismissed: 'ghost',
    appealed: 'warning',
};

const STATUS_TONE: Record<string, EntityStatusTone> = {
    open: 'amber',
    under_review: 'neutral',
    resolved: 'green',
    dismissed: 'neutral',
    appealed: 'amber',
};

export default async function DisciplinaryCaseDetailPage({
    params,
}: {
    params: Promise<{ caseId: string }>;
}) {
    const { caseId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/dashboard/hrm/hr/disciplinary');

    const c = await getDisciplinaryCaseById(caseId);
    if (!c) redirect('/dashboard/hrm/hr/disciplinary');

    const rawId = ((c as any)._id as any)?.toString?.() ?? String((c as any)._id ?? '');
    const shortId = rawId.slice(-8) || rawId;

    const employeeName =
        ((c as any).employeeName as string | undefined) ||
        ((c as any).employeeId as any)?.toString?.() ||
        String((c as any).employeeId ?? '') ||
        '—';

    const raisedBy =
        ((c as any).raisedBy as string | undefined) || '—';

    const type = ((c as any).type as string | undefined) || '—';
    const severity = ((c as any).severity as string | undefined) || '';
    const status = ((c as any).status as string | undefined) || '';
    const decision = ((c as any).decision as string | undefined) || '';
    const notes = ((c as any).notes as string | undefined) || '';

    const evidenceList = Array.isArray((c as any).evidence)
        ? ((c as any).evidence as Array<Record<string, unknown>>)
        : [];
    const hearingsList = Array.isArray((c as any).hearings)
        ? ((c as any).hearings as Array<Record<string, unknown>>)
        : [];
    const evidenceCount = evidenceList.length;
    const hearingsCount = hearingsList.length;

    const severityVariant: SeverityVariant = SEVERITY_VARIANT[severity.toLowerCase()] ?? 'ghost';
    const statusVariant: StatusVariant = STATUS_VARIANT[status.toLowerCase()] ?? 'ghost';

    return (
        <EntityDetailShell
            eyebrow="DISCIPLINARY CASE"
            title={`Case #${shortId}`}
            status={status ? { label: status.replace('_', ' '), tone: STATUS_TONE[status.toLowerCase()] ?? 'neutral' } : undefined}
            back={{ href: '/dashboard/hrm/hr/disciplinary', label: 'Disciplinary cases' }}
            actions={
                <>
                    <AddHearingDialog caseId={id} />
                    <HrActionButtons
                            actions={[
                                {
                                    key: 'close',
                                    kind: 'prompt',
                                    label: 'Close case',
                                    icon: <CheckCircle2 className="h-4 w-4" />,
                                    promptTitle: 'Close disciplinary case',
                                    promptDescription:
                                        'Record the final decision; the case will be marked resolved.',
                                    submitLabel: 'Close',
                                    fields: [
                                        {
                                            name: 'decision',
                                            label: 'Decision',
                                            type: 'textarea',
                                            required: true,
                                        },
                                    ],
                                    onRun: (v) =>
                                        closeDisciplinaryCase(caseId, v.decision ?? ''),
                                },
                                {
                                    key: 'escalate',
                                    kind: 'action',
                                    label: 'Escalate',
                                    icon: <AlertTriangle className="h-4 w-4" />,
                                    onRun: () => escalateDisciplinaryCase(caseId),
                                },
                                {
                                    key: 'appeal',
                                    kind: 'prompt',
                                    label: 'Appeal',
                                    icon: <Scale className="h-4 w-4" />,
                                    variant: 'destructive',
                                    promptTitle: 'File an appeal',
                                    promptDescription:
                                        'Record the grounds for appeal. The case status changes to "appealed".',
                                    submitLabel: 'Appeal',
                                    fields: [
                                        {
                                            name: 'reason',
                                            label: 'Reason',
                                            type: 'textarea',
                                            required: true,
                                        },
                                    ],
                                    onRun: (v) =>
                                        appealDisciplinaryCase(caseId, v.reason ?? ''),
                                },
                            ]}
                        />
                </>
            }
        >

            <Card className="p-6">
                <div className="mb-4 text-[14px] font-medium text-[var(--st-text)]">Case Details</div>

                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    {/* Case No / ID */}
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Case No / ID</div>
                        <div className="font-mono text-[var(--st-text)]">{shortId}</div>
                    </div>

                    {/* Employee */}
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Employee</div>
                        <div className="text-[var(--st-text)]">{employeeName}</div>
                    </div>

                    {/* Raised By */}
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Raised By</div>
                        <div className="text-[var(--st-text)]">{raisedBy}</div>
                    </div>

                    {/* Type */}
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Type</div>
                        <div className="text-[var(--st-text)] capitalize">{type}</div>
                    </div>

                    {/* Severity */}
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Severity</div>
                        {severity ? (
                            <Badge variant={severityVariant} className="mt-0.5">
                                {severity}
                            </Badge>
                        ) : (
                            <div className="text-[var(--st-text)]">—</div>
                        )}
                    </div>

                    {/* Status */}
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Status</div>
                        {status ? (
                            <Badge variant={statusVariant} className="mt-0.5">
                                {status.replace('_', ' ')}
                            </Badge>
                        ) : (
                            <div className="text-[var(--st-text)]">—</div>
                        )}
                    </div>

                    {/* Date Opened */}
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Date Opened</div>
                        <div className="text-[var(--st-text)]">{fmtDate((c as any).createdAt)}</div>
                    </div>

                    {/* Evidence count */}
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Evidence</div>
                        <div className="text-[var(--st-text)]">{evidenceCount} item{evidenceCount === 1 ? '' : 's'}</div>
                    </div>

                    {/* Hearings count */}
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Hearings</div>
                        <div className="text-[var(--st-text)]">{hearingsCount} hearing{hearingsCount === 1 ? '' : 's'}</div>
                    </div>

                    {/* Decision — full width if present */}
                    {decision && (
                        <div className="sm:col-span-2">
                            <div className="text-[var(--st-text-secondary)]">Decision</div>
                            <div className="text-[var(--st-text)]">{decision}</div>
                        </div>
                    )}

                    {/* Notes — full width if present */}
                    {notes && (
                        <div className="sm:col-span-2">
                            <div className="text-[var(--st-text-secondary)]">Notes</div>
                            <div className="whitespace-pre-wrap text-[var(--st-text)]">{notes}</div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Hearings timeline */}
            <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[15px] font-medium text-[var(--st-text)]">Hearings</h2>
                    <span className="text-[12px] text-[var(--st-text-secondary)]">
                        {hearingsCount} hearing{hearingsCount === 1 ? '' : 's'}
                    </span>
                </div>
                {hearingsList.length === 0 ? (
                    <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                        No hearings scheduled.
                    </div>
                ) : (
                    <ol className="space-y-3">
                        {hearingsList.map((h, i) => (
                            <li
                                key={i}
                                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3"
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <div className="text-[13px] font-medium text-[var(--st-text)]">
                                        Hearing #{i + 1}
                                        {h.title ? ` · ${String(h.title)}` : ''}
                                    </div>
                                    <div className="text-[12px] text-[var(--st-text-secondary)]">
                                        {fmtDate(h.date || h.scheduledAt)}
                                    </div>
                                </div>
                                {h.outcome ? (
                                    <div className="mt-1.5">
                                        <Badge variant="ghost">{String(h.outcome)}</Badge>
                                    </div>
                                ) : null}
                                {h.notes ? (
                                    <div className="mt-1.5 whitespace-pre-wrap text-[12.5px] text-[var(--st-text)]">
                                        {String(h.notes)}
                                    </div>
                                ) : null}
                                {h.panelMembers ? (
                                    <div className="mt-1.5 text-[11.5px] text-[var(--st-text-secondary)]">
                                        Panel: {String(h.panelMembers)}
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ol>
                )}
            </Card>

            {/* Evidence */}
            <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[15px] font-medium text-[var(--st-text)]">Evidence</h2>
                    <span className="text-[12px] text-[var(--st-text-secondary)]">
                        {evidenceCount} item{evidenceCount === 1 ? '' : 's'}
                    </span>
                </div>
                {evidenceList.length === 0 ? (
                    <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                        No evidence attached.
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {evidenceList.map((ev, i) => {
                            const url = (ev.url as string) || (ev.fileUrl as string) || '';
                            const label =
                                (ev.name as string) ||
                                (ev.title as string) ||
                                (ev.type as string) ||
                                `Evidence #${i + 1}`;
                            return url ? (
                                <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2.5 py-1 text-[12px] text-[var(--st-text)] hover:underline"
                                >
                                    {label}
                                </a>
                            ) : (
                                <Badge key={i} variant="ghost">{label}</Badge>
                            );
                        })}
                    </div>
                )}
            </Card>
        </EntityDetailShell>
    );
}
