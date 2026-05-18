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
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Pencil,
  ShieldCheck } from 'lucide-react';

/**
 * Probation detail page.
 *
 * Server component — fetches the probation by id via the action layer
 * and renders an overview card, evaluation criteria table and notes.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import {
    getCrmProbationById,
    type ProbationStatus,
} from '@/app/actions/crm-probation.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/probation';

const STATUS_TONE: Record<ProbationStatus, StatusTone> = {
    in_progress: 'blue',
    confirmed: 'green',
    extended: 'amber',
    terminated: 'red',
    archived: 'neutral',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function pretty(s?: string): string {
    if (!s) return '—';
    return s.replace(/_/g, ' ');
}

export default async function ProbationDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: probationId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const probation = await getCrmProbationById(probationId);
    if (!probation) notFound();

    const status = (probation.status ?? 'in_progress') as ProbationStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';

    const employeeRef = probation.employeeName || probation.employeeId || 'Probation';
    const criteria = Array.isArray(probation.criteria) ? probation.criteria : [];

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Probation', href: BASE },
                    { label: String(employeeRef) },
                ]}
                title={`Probation · ${employeeRef}`}
                subtitle="Evaluation criteria, scores and outcome."
                icon={ShieldCheck}
                actions={
                    <div className="flex items-center gap-2">
                        <ZoruButton variant="outline" asChild>
                            <Link href={BASE}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Link>
                        </ZoruButton>
                        <ZoruButton asChild>
                            <Link href={`${BASE}/${probationId}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                            </Link>
                        </ZoruButton>
                    </div>
                }
            />

            {/* Summary card */}
            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
                    <StatusPill label={pretty(status)} tone={tone} />
                    {probation.recommendation ? (
                        <ZoruBadge variant="ghost">
                            Recommendation: {probation.recommendation}
                        </ZoruBadge>
                    ) : null}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Employee</div>
                        <div className="text-zoru-ink">{probation.employeeName || '—'}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Employee ID</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {probation.employeeId || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Evaluator</div>
                        <div className="text-zoru-ink">
                            {probation.evaluatorName || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Evaluator ID</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {probation.evaluatorId || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Start date</div>
                        <div className="text-zoru-ink">{fmtDate(probation.startDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">End date</div>
                        <div className="text-zoru-ink">{fmtDate(probation.endDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Overall score</div>
                        <div className="font-mono text-zoru-ink">
                            {probation.overallScore != null ? probation.overallScore : '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Recommendation</div>
                        <div className="capitalize text-zoru-ink">
                            {pretty(probation.recommendation)}
                        </div>
                    </div>
                </div>
            </ZoruCard>

            {/* Criteria */}
            <ZoruCard className="p-6">
                <div className="mb-3 text-[15px] font-medium text-zoru-ink">
                    Evaluation criteria
                </div>
                {criteria.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No criteria recorded.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Criterion</ZoruTableHead>
                                    <ZoruTableHead>Target</ZoruTableHead>
                                    <ZoruTableHead>Achieved</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Score</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {criteria.map((c, i) => (
                                    <ZoruTableRow key={i}>
                                        <ZoruTableCell className="text-zoru-ink">{c.name}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">{c.target || '—'}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">{c.achieved || '—'}</ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-[12px] text-zoru-ink">
                                            {c.score != null ? c.score : '—'}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                )}
            </ZoruCard>

            {/* Notes */}
            <ZoruCard className="p-6">
                <div className="mb-3 text-[15px] font-medium text-zoru-ink">Notes</div>
                {probation.notes ? (
                    <pre className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4 font-sans text-[13px] text-zoru-ink">
                        {probation.notes}
                    </pre>
                ) : (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No notes recorded.
                    </div>
                )}
            </ZoruCard>
        </div>
    );
}
