import { Button, Card } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Asset assignment detail page — server component.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getAssetAssignmentById } from '@/app/actions/crm-asset-assignments.actions';
import type { CrmAssetAssignmentStatus } from '@/app/actions/crm-asset-assignments.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/asset-assignments';

const STATUS_TONE: Record<CrmAssetAssignmentStatus, StatusTone> = {
    assigned: 'blue',
    returned: 'green',
    lost: 'red',
    damaged: 'red',
    archived: 'neutral',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

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
        </EntityListShell>
    );
}
