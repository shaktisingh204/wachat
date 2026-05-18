import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  redirect } from 'next/navigation';
import {
    Gavel,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Scale,
  } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';

/**
 * Disciplinary case detail page.
 *
 * Server component that renders a ZoruCard "Case Details" grid for a
 * single disciplinary case from the `crm_disciplinary_cases` collection.
 * Requires an active session; redirects to the list page otherwise or
 * when the case is not found.
 */

import Link from 'next/link';

import { CrmPageHeader } from '../../../../crm/_components/crm-page-header';
import { getDisciplinaryCaseById } from '@/app/actions/crm-disciplinary.actions';
import { getSession } from '@/app/actions/user.actions';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import {
    closeDisciplinaryCase,
    escalateDisciplinaryCase,
    appealDisciplinaryCase,
} from '@/app/actions/hr-status-flow.actions';

export const dynamic = 'force-dynamic';

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Case #${shortId}`}
                subtitle="Disciplinary case detail"
                icon={Gavel}
                actions={
                    <div className="flex items-center gap-2">
                        <Link href="/dashboard/hrm/hr/disciplinary">
                            <ZoruButton variant="outline">
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </ZoruButton>
                        </Link>
                        <ZoruButton variant="outline" disabled>
                            <PlusCircle className="h-4 w-4" />
                            Add Hearing
                        </ZoruButton>
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
                    </div>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4 text-[14px] font-medium text-zoru-ink">Case Details</div>

                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    {/* Case No / ID */}
                    <div>
                        <div className="text-zoru-ink-muted">Case No / ID</div>
                        <div className="font-mono text-zoru-ink">{shortId}</div>
                    </div>

                    {/* Employee */}
                    <div>
                        <div className="text-zoru-ink-muted">Employee</div>
                        <div className="text-zoru-ink">{employeeName}</div>
                    </div>

                    {/* Raised By */}
                    <div>
                        <div className="text-zoru-ink-muted">Raised By</div>
                        <div className="text-zoru-ink">{raisedBy}</div>
                    </div>

                    {/* Type */}
                    <div>
                        <div className="text-zoru-ink-muted">Type</div>
                        <div className="text-zoru-ink capitalize">{type}</div>
                    </div>

                    {/* Severity */}
                    <div>
                        <div className="text-zoru-ink-muted">Severity</div>
                        {severity ? (
                            <ZoruBadge variant={severityVariant} className="mt-0.5">
                                {severity}
                            </ZoruBadge>
                        ) : (
                            <div className="text-zoru-ink">—</div>
                        )}
                    </div>

                    {/* Status */}
                    <div>
                        <div className="text-zoru-ink-muted">Status</div>
                        {status ? (
                            <ZoruBadge variant={statusVariant} className="mt-0.5">
                                {status.replace('_', ' ')}
                            </ZoruBadge>
                        ) : (
                            <div className="text-zoru-ink">—</div>
                        )}
                    </div>

                    {/* Date Opened */}
                    <div>
                        <div className="text-zoru-ink-muted">Date Opened</div>
                        <div className="text-zoru-ink">{fmtDate((c as any).createdAt)}</div>
                    </div>

                    {/* Evidence count */}
                    <div>
                        <div className="text-zoru-ink-muted">Evidence</div>
                        <div className="text-zoru-ink">{evidenceCount} item{evidenceCount === 1 ? '' : 's'}</div>
                    </div>

                    {/* Hearings count */}
                    <div>
                        <div className="text-zoru-ink-muted">Hearings</div>
                        <div className="text-zoru-ink">{hearingsCount} hearing{hearingsCount === 1 ? '' : 's'}</div>
                    </div>

                    {/* Decision — full width if present */}
                    {decision && (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Decision</div>
                            <div className="text-zoru-ink">{decision}</div>
                        </div>
                    )}

                    {/* Notes — full width if present */}
                    {notes && (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Notes</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">{notes}</div>
                        </div>
                    )}
                </div>
            </ZoruCard>

            {/* Hearings timeline */}
            <ZoruCard className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[15px] font-medium text-zoru-ink">Hearings</h2>
                    <span className="text-[12px] text-zoru-ink-muted">
                        {hearingsCount} hearing{hearingsCount === 1 ? '' : 's'}
                    </span>
                </div>
                {hearingsList.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No hearings scheduled.
                    </div>
                ) : (
                    <ol className="space-y-3">
                        {hearingsList.map((h, i) => (
                            <li
                                key={i}
                                className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3"
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <div className="text-[13px] font-medium text-zoru-ink">
                                        Hearing #{i + 1}
                                        {h.title ? ` · ${String(h.title)}` : ''}
                                    </div>
                                    <div className="text-[12px] text-zoru-ink-muted">
                                        {fmtDate(h.date || h.scheduledAt)}
                                    </div>
                                </div>
                                {h.outcome ? (
                                    <div className="mt-1.5">
                                        <ZoruBadge variant="ghost">{String(h.outcome)}</ZoruBadge>
                                    </div>
                                ) : null}
                                {h.notes ? (
                                    <div className="mt-1.5 whitespace-pre-wrap text-[12.5px] text-zoru-ink">
                                        {String(h.notes)}
                                    </div>
                                ) : null}
                                {h.panelMembers ? (
                                    <div className="mt-1.5 text-[11.5px] text-zoru-ink-muted">
                                        Panel: {String(h.panelMembers)}
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ol>
                )}
            </ZoruCard>

            {/* Evidence */}
            <ZoruCard className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[15px] font-medium text-zoru-ink">Evidence</h2>
                    <span className="text-[12px] text-zoru-ink-muted">
                        {evidenceCount} item{evidenceCount === 1 ? '' : 's'}
                    </span>
                </div>
                {evidenceList.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
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
                                    className="inline-flex items-center rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 px-2.5 py-1 text-[12px] text-zoru-ink hover:underline"
                                >
                                    {label}
                                </a>
                            ) : (
                                <ZoruBadge key={i} variant="ghost">{label}</ZoruBadge>
                            );
                        })}
                    </div>
                )}
            </ZoruCard>
        </div>
    );
}
