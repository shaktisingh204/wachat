import { Button, Card } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Subtask detail page.
 *
 * Server component — fetches the subtask via `getSubtaskById`, then
 * renders a summary card. Parent task, assignee, and dates are surfaced
 * inline.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { canServer } from '@/lib/rbac-server';
import { getSubtaskById } from '@/app/actions/crm-subtasks.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/projects/subtasks';

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string | Date);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default async function SubtaskDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const allowed = await canServer('crm_subtask', 'view');
    if (!allowed) redirect('/dashboard/crm/projects');

    const subtask = await getSubtaskById(id);
    if (!subtask) notFound();

    const canEdit = await canServer('crm_subtask', 'update');

    return (
        <EntityDetailShell
            eyebrow="SUBTASK"
            title={subtask.title || 'Untitled subtask'}
            back={{ href: BASE, label: 'Subtasks' }}
            actions={
                canEdit ? (
                    <Button asChild>
                        <Link href={`${BASE}/${id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </Link>
                    </Button>
                ) : undefined
            }
        >

            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">
                        Overview
                    </div>
                    <StatusPill
                        label={subtask.status.replace(/_/g, ' ')}
                        tone={statusToTone(subtask.status)}
                    />
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Parent kind</div>
                        <div className="text-zoru-ink">
                            {subtask.parentKind === 'project_task'
                                ? 'Project task'
                                : 'CRM task'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Parent id</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {subtask.parentId}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Assignee</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {subtask.assigneeId || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Due date</div>
                        <div className="text-zoru-ink">{fmtDate(subtask.dueDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Order</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {subtask.order ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Completed</div>
                        <div className="text-zoru-ink">
                            {fmtDate(subtask.completedAt)}
                        </div>
                    </div>
                    {subtask.description ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Description</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">
                                {subtask.description}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>

            <Card className="p-6">
                <h2 className="text-[14px] font-semibold text-zoru-ink">Audit</h2>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px]">
                    <div className="text-zoru-ink-muted">Created</div>
                    <div className="text-zoru-ink">{fmtDate(subtask.createdAt)}</div>
                    <div className="text-zoru-ink-muted">Updated</div>
                    <div className="text-zoru-ink">{fmtDate(subtask.updatedAt)}</div>
                </div>
            </Card>
        </EntityDetailShell>
    );
}
