import { fmtDate } from '@/lib/utils';
import { Button, Card } from '@/components/zoruui';
import { notFound, redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getAssetAssignmentById, getAssetAssignmentsByAssetId } from '@/app/actions/crm-asset-assignments.actions';
import type { CrmAssetAssignmentStatus } from '@/app/actions/crm-asset-assignments.actions';
import { AssetHandoverDocument } from '../_components/asset-handover-document';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/asset-assignments';

const STATUS_TONE: Record<CrmAssetAssignmentStatus, StatusTone> = {
    assigned: 'blue',
    returned: 'green',
    lost: 'red',
    damaged: 'red',
    archived: 'neutral',
};



function pretty(s?: string | null): string {
    if (!s) return '—';
    return s.replace(/_/g, ' ');
}

export default async function AssetAssignmentDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const assignment = await getAssetAssignmentById(id);
    if (!assignment) notFound();

    const history = await getAssetAssignmentsByAssetId(assignment.asset_id, id);

    const status = (assignment.status ?? 'assigned') as CrmAssetAssignmentStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';
    const title = assignment.asset_name || assignment.asset_id;

    return (
        <EntityListShell
            title={title}
            subtitle={`Assigned to ${assignment.employee_name || assignment.employee_id}`}
            primaryAction={
                <Button asChild>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >
            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
                    <StatusPill label={pretty(status)} tone={tone} />
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Asset</div>
                        <div className="text-zoru-ink">{assignment.asset_name || '—'}</div>
                        <div className="font-mono text-[11.5px] text-zoru-ink-muted">
                            {assignment.asset_id}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Employee</div>
                        <div className="text-zoru-ink">{assignment.employee_name || '—'}</div>
                        <div className="font-mono text-[11.5px] text-zoru-ink-muted">
                            {assignment.employee_id}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Assigned at</div>
                        <div className="text-zoru-ink">{fmtDate(assignment.assigned_at)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Returned at</div>
                        <div className="text-zoru-ink">{fmtDate(assignment.returned_at)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Condition at assign</div>
                        <div className="capitalize text-zoru-ink">
                            {pretty(assignment.condition_at_assign as string | undefined)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Condition at return</div>
                        <div className="capitalize text-zoru-ink">
                            {pretty(assignment.condition_at_return as string | undefined)}
                        </div>
                    </div>
                    {assignment.notes ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Notes</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">{assignment.notes}</div>
                        </div>
                    ) : null}
                </div>
            </Card>

            <AssetHandoverDocument assignment={assignment} />

            {history.length > 0 && (
                <Card className="p-6 mt-6">
                    <div className="mb-4 text-[14px] font-medium text-zoru-ink">Assignment History</div>
                    <div className="grid gap-4">
                        {history.map((h) => {
                            const hStatus = (h.status ?? 'assigned') as CrmAssetAssignmentStatus;
                            const hTone = STATUS_TONE[hStatus] ?? 'neutral';
                            return (
                                <div key={h._id} className="border border-zoru-line rounded-lg p-4 flex flex-col sm:flex-row justify-between gap-4">
                                    <div>
                                        <div className="text-[13px] font-medium text-zoru-ink mb-1">
                                            {h.employee_name || h.employee_id}
                                        </div>
                                        <div className="text-[12px] text-zoru-ink-muted">
                                            Assigned: {fmtDate(h.assigned_at)}
                                            {h.returned_at ? ` • Returned: ${fmtDate(h.returned_at)}` : ''}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-[12px] text-zoru-ink-muted text-right">
                                            <div>Cond: {pretty(h.condition_at_assign as string)}</div>
                                            {h.condition_at_return && <div>Ret: {pretty(h.condition_at_return as string)}</div>}
                                        </div>
                                        <StatusPill label={pretty(hStatus)} tone={hTone} />
                                        <Button variant="ghost" size="sm" asChild>
                                            <Link href={`${BASE}/${h._id}`}>View</Link>
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}
        </EntityListShell>
    );
}
