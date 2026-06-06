import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';

/**
 * Edit project — §1B W7.
 *
 * Reuses the same `ProjectForm` exported from `projects/new/page.tsx` so
 * the create + edit surfaces stay structurally identical. The form
 * action (`saveWsProject`) flips to PATCH when a hidden `_id` is present.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getWsProjectById } from '@/app/actions/worksuite/projects.actions';
import { ProjectForm } from '../../_components/project-form';
import { Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

function dateInput(v: unknown): string {
    if (!v) return '';
    const d = new Date(v as string | number | Date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function EditProjectSkeleton() {
    return (
        <div className="flex w-full flex-col gap-6 animate-pulse">
            {/* Header / Intro section of the form skeleton */}
            <div className="flex flex-col gap-2">
                <Skeleton className="h-8 w-48 rounded" />
                <Skeleton className="h-4 w-96 rounded" />
            </div>

            {/* Simulated Cards/Sections */}
            <div className="flex flex-col gap-4">
                {/* Basic info card skeleton */}
                <div className="rounded-xl border border-[var(--st-border)] p-6 space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-32 rounded" />
                        <Skeleton className="h-4 w-64 rounded" />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="md:col-span-2 space-y-2">
                            <Skeleton className="h-4 w-28 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                        </div>
                    </div>
                </div>

                {/* Timeline & status card skeleton */}
                <div className="rounded-xl border border-[var(--st-border)] p-6 space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-40 rounded" />
                        <Skeleton className="h-4 w-64 rounded" />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-16 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-16 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                        </div>
                    </div>
                </div>

                {/* Budget & hours skeleton */}
                <div className="rounded-xl border border-[var(--st-border)] p-6 space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-36 rounded" />
                        <Skeleton className="h-4 w-64 rounded" />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-28 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-28 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                        </div>
                        <div className="flex items-center gap-3 pt-6">
                            <Skeleton className="h-6 w-10 rounded-full" />
                            <Skeleton className="h-4 w-28 rounded" />
                        </div>
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-6 w-10 rounded-full" />
                            <Skeleton className="h-4 w-36 rounded" />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <Skeleton className="h-4 w-32 rounded" />
                            <Skeleton className="h-10 w-full rounded" />
                            <Skeleton className="h-3 w-72 rounded" />
                        </div>
                    </div>
                </div>

                {/* Description & notes skeleton */}
                <div className="rounded-xl border border-[var(--st-border)] p-6 space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-44 rounded" />
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24 rounded" />
                            <Skeleton className="h-24 w-full rounded" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-28 rounded" />
                            <Skeleton className="h-20 w-full rounded" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom action bar skeleton */}
            <div className="sticky bottom-0 bg-[var(--st-bg)] border-t border-[var(--st-border)] py-3 flex items-center justify-end gap-2">
                <Skeleton className="h-10 w-20 rounded" />
                <Skeleton className="h-10 w-32 rounded" />
            </div>
        </div>
    );
}

interface EditProjectFormContainerProps {
    projectId: string;
}

async function EditProjectFormContainer({ projectId }: EditProjectFormContainerProps) {
    const project = await getWsProjectById(projectId);
    if (!project) notFound();
    const p = project as Record<string, unknown> & { _id: string };

    return (
        <ProjectForm
            initial={{
                _id: String(p._id),
                name: p.name as string | undefined,
                clientId: p.clientId as string | undefined,
                projectAdmin: p.projectAdmin as string | undefined,
                categoryId: p.categoryId as string | undefined,
                subCategoryId: p.subCategoryId as string | undefined,
                departmentId: p.departmentId as string | undefined,
                status: p.status as string | undefined,
                priority: p.priority as string | undefined,
                completionPercent: p.completionPercent as number | undefined,
                projectBudget: p.projectBudget as number | undefined,
                currency: p.currency as string | undefined,
                hoursAllocated: p.hoursAllocated as number | undefined,
                startDate: dateInput(p.startDate),
                deadline: dateInput(p.deadline ?? p.endDate),
                projectShortCode: p.projectShortCode as string | undefined,
                description: p.description as string | undefined,
                notes: p.notes as string | undefined,
                billable: p.billable as number | undefined,
                public: p.public as number | undefined,
            }}
        />
    );
}

export default async function EditProjectPage({
    params,
}: {
    params: Promise<{ projectId: string }>;
}) {
    const { projectId } = await params;

    return (
        <EntityDetailShell
            eyebrow="PROJECT"
            title="Edit Project"
            back={{ href: `/dashboard/crm/projects/${projectId}`, label: 'Back to project' }}
        >
            <Suspense fallback={<EditProjectSkeleton />}>
                <EditProjectFormContainer projectId={projectId} />
            </Suspense>
        </EntityDetailShell>
    );
}
