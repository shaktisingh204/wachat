import { fmtDate } from '@/lib/utils';
import { Badge, Button, Card, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Probation detail page.
 *
 * Server component — fetches the probation by id via the action layer
 * and renders an overview card, evaluation criteria table and notes.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
        <EntityListShell
            title={`Probation · ${employeeRef}`}
            subtitle="Evaluation criteria, scores and outcome."
            primaryAction={
                <Button asChild>
                    <Link href={`${BASE}/${probationId}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >

            {/* Summary card */}
            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-[var(--st-text)]">Overview</div>
                    <StatusPill label={pretty(status)} tone={tone} />
                    {probation.recommendation ? (
                        <Badge variant="ghost">
                            Recommendation: {probation.recommendation}
                        </Badge>
                    ) : null}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Employee</div>
                        <div className="text-[var(--st-text)]">{probation.employeeName || '—'}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Employee ID</div>
                        <div className="font-mono text-[12px] text-[var(--st-text)]">
                            {probation.employeeId || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Evaluator</div>
                        <div className="text-[var(--st-text)]">
                            {probation.evaluatorName || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Evaluator ID</div>
                        <div className="font-mono text-[12px] text-[var(--st-text)]">
                            {probation.evaluatorId || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Start date</div>
                        <div className="text-[var(--st-text)]">{fmtDate(probation.startDate)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">End date</div>
                        <div className="text-[var(--st-text)]">{fmtDate(probation.endDate)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Overall score</div>
                        <div className="font-mono text-[var(--st-text)]">
                            {probation.overallScore != null ? probation.overallScore : '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Recommendation</div>
                        <div className="capitalize text-[var(--st-text)]">
                            {pretty(probation.recommendation)}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Criteria */}
            <Card className="p-6">
                <div className="mb-3 text-[15px] font-medium text-[var(--st-text)]">
                    Evaluation criteria
                </div>
                {criteria.length === 0 ? (
                    <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                        No criteria recorded.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Criterion</Th>
                                    <Th>Target</Th>
                                    <Th>Achieved</Th>
                                    <Th className="text-right">Score</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {criteria.map((c, i) => (
                                    <Tr key={i}>
                                        <Td className="text-[var(--st-text)]">{c.name}</Td>
                                        <Td className="text-[var(--st-text)]">{c.target || '—'}</Td>
                                        <Td className="text-[var(--st-text)]">{c.achieved || '—'}</Td>
                                        <Td className="text-right font-mono text-[12px] text-[var(--st-text)]">
                                            {c.score != null ? c.score : '—'}
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </div>
                )}
            </Card>

            {/* Notes */}
            <Card className="p-6">
                <div className="mb-3 text-[15px] font-medium text-[var(--st-text)]">Notes</div>
                {probation.notes ? (
                    <pre className="whitespace-pre-wrap rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4 font-sans text-[13px] text-[var(--st-text)]">
                        {probation.notes}
                    </pre>
                ) : (
                    <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                        No notes recorded.
                    </div>
                )}
            </Card>
        </EntityListShell>
    );
}
