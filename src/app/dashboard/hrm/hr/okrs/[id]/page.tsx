import { fmtDate } from '@/lib/utils';
import { Badge, Button, Card, Progress } from '@/components/sabcrm/20ui/compat';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * OKR detail page.
 *
 * Server component — fetches the OKR by id via `getOkrById` and renders a
 * summary card, progress + confidence strip, and the key-results list.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getOkrById } from '@/app/actions/crm-okrs.actions';
import type {
    CrmOkrKeyResult,
    CrmOkrKeyResultStatus,
    CrmOkrStatus,
} from '@/lib/rust-client/crm-okrs';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/okrs';

const STATUS_TONE: Record<CrmOkrStatus, StatusTone> = {
    draft: 'neutral',
    in_progress: 'blue',
    on_track: 'green',
    at_risk: 'amber',
    behind: 'red',
    completed: 'green',
    missed: 'red',
    archived: 'neutral',
};

const KR_STATUS_TONE: Record<CrmOkrKeyResultStatus, StatusTone> = {
    on_track: 'green',
    at_risk: 'amber',
    behind: 'red',
    completed: 'green',
};



function pretty(s?: string): string {
    if (!s) return '—';
    return s.replace(/_/g, ' ');
}

function clampPercent(n: unknown): number {
    const v = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, Math.round(v)));
}

export default async function OkrDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: okrId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const okr = await getOkrById(okrId);
    if (!okr) notFound();

    const status = (okr.status ?? 'draft') as CrmOkrStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';
    const progress = clampPercent(okr.progress);
    const confidence =
        typeof okr.confidence === 'number' ? clampPercent(okr.confidence) : null;

    const krs = Array.isArray(okr.keyResults) ? (okr.keyResults as CrmOkrKeyResult[]) : [];
    const tags = Array.isArray(okr.tags) ? okr.tags : [];

    return (
        <EntityListShell
            title={okr.objective}
            subtitle={okr.description || 'OKR detail'}
            primaryAction={
                <Button asChild>
                    <Link href={`${BASE}/${okrId}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >

            {/* Summary card */}
            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
                    <StatusPill label={pretty(status)} tone={tone} />
                    {tags.map((t) => (
                        <Badge key={t} variant="ghost">
                            {t}
                        </Badge>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Period</div>
                        <div className="font-mono text-zoru-ink">{okr.period || '—'}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Owner</div>
                        <div className="text-zoru-ink">
                            {okr.ownerName ?? okr.ownerId ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Team / Department</div>
                        <div className="text-zoru-ink">
                            {okr.teamId ?? okr.departmentId ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Parent OKR</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {okr.parentOkrId || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Start date</div>
                        <div className="text-zoru-ink">{fmtDate(okr.startDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">End date</div>
                        <div className="text-zoru-ink">{fmtDate(okr.endDate)}</div>
                    </div>
                </div>
            </Card>

            {/* Progress strip */}
            <Card className="p-6">
                <div className="mb-3 text-[14px] font-medium text-zoru-ink">
                    Progress
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                            <span className="text-zoru-ink-muted">Overall progress</span>
                            <span className="font-mono tabular-nums text-zoru-ink">
                                {progress}%
                            </span>
                        </div>
                        <Progress value={progress} />
                    </div>
                    {confidence != null ? (
                        <div>
                            <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                                <span className="text-zoru-ink-muted">Confidence</span>
                                <span className="font-mono tabular-nums text-zoru-ink">
                                    {confidence}%
                                </span>
                            </div>
                            <Progress value={confidence} />
                        </div>
                    ) : null}
                </div>
            </Card>

            {/* Key results */}
            <Card className="p-6">
                <div className="mb-3 text-[15px] font-medium text-zoru-ink">
                    Key results ({krs.length})
                </div>
                {krs.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No key results yet.
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {krs.map((kr) => {
                            const tgt = typeof kr.targetValue === 'number' ? kr.targetValue : null;
                            const cur = typeof kr.currentValue === 'number' ? kr.currentValue : null;
                            const krProgress =
                                tgt != null && tgt > 0 && cur != null
                                    ? clampPercent((cur / tgt) * 100)
                                    : null;
                            const krStatus = kr.status as CrmOkrKeyResultStatus;
                            const krTone = KR_STATUS_TONE[krStatus] ?? 'neutral';
                            return (
                                <div
                                    key={kr.id}
                                    className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3"
                                >
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <div className="font-medium text-zoru-ink">{kr.title}</div>
                                        <StatusPill label={pretty(krStatus)} tone={krTone} />
                                    </div>
                                    <div className="grid gap-3 text-[12.5px] sm:grid-cols-4">
                                        <div>
                                            <div className="text-zoru-ink-muted">Metric</div>
                                            <div className="text-zoru-ink">{kr.metric ?? '—'}</div>
                                        </div>
                                        <div>
                                            <div className="text-zoru-ink-muted">Target</div>
                                            <div className="font-mono tabular-nums text-zoru-ink">
                                                {tgt != null ? `${tgt}${kr.unit ? ` ${kr.unit}` : ''}` : '—'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-zoru-ink-muted">Current</div>
                                            <div className="font-mono tabular-nums text-zoru-ink">
                                                {cur != null ? `${cur}${kr.unit ? ` ${kr.unit}` : ''}` : '—'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-zoru-ink-muted">Progress</div>
                                            {krProgress != null ? (
                                                <div className="flex items-center gap-2">
                                                    <Progress
                                                        value={krProgress}
                                                        className="h-2 w-20"
                                                    />
                                                    <span className="font-mono tabular-nums text-zoru-ink">
                                                        {krProgress}%
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="text-zoru-ink">—</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </EntityListShell>
    );
}
