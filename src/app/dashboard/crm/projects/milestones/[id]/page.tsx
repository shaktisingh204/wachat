import { ZoruBadge, ZoruButton, ZoruCard, ZoruProgress } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Flag,
  Pencil } from 'lucide-react';

/**
 * Milestone detail page.
 *
 * Server component — fetches the milestone via `getMilestoneById` and
 * surfaces its summary card with progress, dates, owner, and tags.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { StatusPill, statusToTone, type StatusTone } from '@/components/crm/status-pill';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getSession } from '@/app/actions/user.actions';
import { canServer } from '@/lib/rbac-server';
import { getMilestoneById } from '@/app/actions/crm-milestones.actions';
import type { CrmMilestonePriority } from '@/lib/rust-client/crm-milestones';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/projects/milestones';

const PRIORITY_TONE: Record<CrmMilestonePriority, StatusTone> = {
    low: 'neutral',
    medium: 'blue',
    high: 'amber',
};

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string | Date);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default async function MilestoneDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const allowed = await canServer('crm_milestone', 'view');
    if (!allowed) redirect('/dashboard/crm/projects');

    const milestone = await getMilestoneById(id);
    if (!milestone) notFound();

    const canEdit = await canServer('crm_milestone', 'edit');
    const progress = Math.max(0, Math.min(100, milestone.progress ?? 0));
    const tags = Array.isArray(milestone.tags) ? milestone.tags : [];

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Projects', href: '/dashboard/crm/projects' },
                    { label: 'Milestones', href: BASE },
                    { label: milestone.name },
                ]}
                title={milestone.name}
                subtitle={milestone.description || 'Milestone detail'}
                icon={Flag}
                actions={
                    <div className="flex items-center gap-2">
                        <ZoruButton variant="outline" asChild>
                            <Link href={BASE}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Link>
                        </ZoruButton>
                        {canEdit ? (
                            <ZoruButton asChild>
                                <Link href={`${BASE}/${id}/edit`}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                </Link>
                            </ZoruButton>
                        ) : null}
                    </div>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
                    <StatusPill
                        label={milestone.status.replace(/_/g, ' ')}
                        tone={statusToTone(milestone.status)}
                    />
                    <StatusPill
                        label={milestone.priority}
                        tone={PRIORITY_TONE[milestone.priority]}
                    />
                    {tags.map((t) => (
                        <ZoruBadge key={t} variant="ghost">
                            {t}
                        </ZoruBadge>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Project</div>
                        <div className="text-zoru-ink">
                            {milestone.projectId ? (
                                <EntityPickerChip
                                    entity="project"
                                    id={milestone.projectId}
                                    fallback="—"
                                />
                            ) : (
                                '—'
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Parent milestone</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {milestone.parentId || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Due date</div>
                        <div className="text-zoru-ink">{fmtDate(milestone.dueDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Completed</div>
                        <div className="text-zoru-ink">
                            {fmtDate(milestone.completedAt)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Owner</div>
                        <div className="text-zoru-ink">
                            {milestone.ownerId ? (
                                <EntityPickerChip
                                    entity="employee"
                                    id={milestone.ownerId}
                                    fallback="—"
                                />
                            ) : (
                                '—'
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Progress</div>
                        <div className="flex items-center gap-2">
                            <ZoruProgress value={progress} className="h-1.5 w-[160px]" />
                            <span className="font-mono text-[12px] text-zoru-ink">
                                {progress}%
                            </span>
                        </div>
                    </div>
                    {milestone.description ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Description</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">
                                {milestone.description}
                            </div>
                        </div>
                    ) : null}
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <h2 className="text-[14px] font-semibold text-zoru-ink">Audit</h2>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px]">
                    <div className="text-zoru-ink-muted">Created</div>
                    <div className="text-zoru-ink">{fmtDate(milestone.createdAt)}</div>
                    <div className="text-zoru-ink-muted">Updated</div>
                    <div className="text-zoru-ink">{fmtDate(milestone.updatedAt)}</div>
                </div>
            </ZoruCard>
        </div>
    );
}
