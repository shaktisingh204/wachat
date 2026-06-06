import { notFound } from 'next/navigation';
import React, { Suspense } from 'react';

/**
 * Edit issue — §1B W7 (deepened §3.3.2).
 *
 * Renders the shared <IssueForm/> wrapped in <EntityDetailShell/> with an
 * activity rail in the right column.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getIssueById } from '@/app/actions/worksuite/meta.actions';
import { Card, ZoruCardHeader, ZoruCardContent } from '@/components/sabcrm/20ui/compat';

import { IssueForm } from '../../_components/issue-form';
import { issueSchema } from '../../schema';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
}

function IssueFormSkeleton() {
    return (
        <div className="flex w-full flex-col gap-5 animate-pulse">
            {/* Overview Card */}
            <Card className="p-0 bg-[var(--st-bg)]/50">
                <ZoruCardHeader>
                    <div className="h-6 w-32 bg-[var(--st-border)]/50 rounded" />
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-4">
                    <div className="space-y-2">
                        <div className="h-4 w-20 bg-[var(--st-border)]/50 rounded" />
                        <div className="h-10 w-full bg-[var(--st-border)]/50 rounded" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-4 w-24 bg-[var(--st-border)]/50 rounded" />
                        <div className="h-28 w-full bg-[var(--st-border)]/50 rounded" />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <div className="h-4 w-20 bg-[var(--st-border)]/50 rounded" />
                            <div className="h-10 w-full bg-[var(--st-border)]/50 rounded" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-4 w-20 bg-[var(--st-border)]/50 rounded" />
                            <div className="h-10 w-full bg-[var(--st-border)]/50 rounded" />
                        </div>
                    </div>
                </ZoruCardContent>
            </Card>

            {/* Classification Card */}
            <Card className="p-0 bg-[var(--st-bg)]/50">
                <ZoruCardHeader>
                    <div className="h-6 w-36 bg-[var(--st-border)]/50 rounded" />
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="space-y-2">
                                <div className="h-4 w-20 bg-[var(--st-border)]/50 rounded" />
                                <div className="h-10 w-full bg-[var(--st-border)]/50 rounded" />
                            </div>
                        ))}
                        <div className="md:col-span-2 space-y-2">
                            <div className="h-4 w-32 bg-[var(--st-border)]/50 rounded" />
                            <div className="h-10 w-full max-w-[200px] bg-[var(--st-border)]/50 rounded" />
                        </div>
                    </div>
                </ZoruCardContent>
            </Card>

            {/* Subtasks Card */}
            <Card className="p-0 bg-[var(--st-bg)]/50">
                <ZoruCardHeader className="flex flex-row items-center justify-between gap-2">
                    <div className="h-6 w-24 bg-[var(--st-border)]/50 rounded" />
                    <div className="h-8 w-28 bg-[var(--st-border)]/50 rounded" />
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="h-10 w-full bg-[var(--st-border)]/50 rounded" />
                </ZoruCardContent>
            </Card>

            {/* Attachments Card */}
            <Card className="p-0 bg-[var(--st-bg)]/50">
                <ZoruCardHeader className="flex flex-row items-center justify-between gap-2">
                    <div className="h-6 w-32 bg-[var(--st-border)]/50 rounded" />
                    <div className="h-8 w-24 bg-[var(--st-border)]/50 rounded" />
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="h-10 w-full bg-[var(--st-border)]/50 rounded" />
                </ZoruCardContent>
            </Card>

            {/* Skeleton Footer */}
            <div className="flex items-center justify-between gap-2 border-t border-[var(--st-border)]/50 bg-[var(--st-bg)] px-4 py-3 -mx-4 -mb-4 mt-1 md:-mx-6 md:px-6">
                <div className="h-10 w-24 bg-[var(--st-border)]/50 rounded" />
                <div className="h-10 w-32 bg-[var(--st-border)]/50 rounded" />
            </div>
        </div>
    );
}

async function EditIssueFormContainer({ id }: { id: string }) {
    const issue = await getIssueById(id);
    if (!issue) notFound();
    
    const parsedIssue = issueSchema.parse(issue);

    return (
        <IssueForm
            mode="edit"
            initial={{
                _id: parsedIssue._id,
                title: parsedIssue.title,
                description: parsedIssue.description || undefined,
                projectId: parsedIssue.projectId || undefined,
                status: parsedIssue.status,
                priority: parsedIssue.priority || undefined,
                severity: parsedIssue.severity || undefined,
                issueType: parsedIssue.issueType || undefined,
                assigneeId: parsedIssue.assigneeId || parsedIssue.assigneeUserId || undefined,
                assigneeName: parsedIssue.assigneeName || undefined,
                reporterId: parsedIssue.reporterId || parsedIssue.reporterUserId || undefined,
                reporterName: parsedIssue.reporterName || undefined,
                dueDate: parsedIssue.dueDate || undefined,
                estimatedHours: parsedIssue.estimatedHours || undefined,
                subtasks: parsedIssue.subtasks || undefined,
                attachments: parsedIssue.attachments || undefined,
            }}
        />
    );
}

export default async function EditIssuePage({ params }: PageProps) {
    const { id } = await params;

    return (
        <EntityDetailShell
            eyebrow="ISSUE"
            title="Edit Issue"
            back={{
                href: `/dashboard/crm/projects/issues/${id}`,
                label: 'Back to issue',
            }}
            rightRail={
                <EntityAuditTimeline
                    entityKind="issue"
                    entityId={String(id)}
                    title="Activity"
                    limit={25}
                />
            }
        >
            <Suspense fallback={<IssueFormSkeleton />}>
                <EditIssueFormContainer id={id} />
            </Suspense>
        </EntityDetailShell>
    );
}

