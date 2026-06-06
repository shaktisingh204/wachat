/**
 * Budget activity (audit log) — server route.
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getBudgetById } from '@/app/actions/crm-budgets.actions';
import { Skeleton } from '@/components/sabcrm/20ui';

interface PageProps {
    params: Promise<{ id: string }>;
}

function ActivitySkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
        </div>
    );
}

export default async function BudgetActivityPage({ params }: PageProps) {
    const { id } = await params;
    
    // We fetch the budget just to get the title and check if it exists.
    const budget = await getBudgetById(id);
    if (!budget) notFound();

    const title = (budget.budgetHead as string) || 'Budget';

    return (
        <EntityDetailShell
            title={`${title} — Activity`}
            eyebrow="BUDGET ACTIVITY"
            back={{
                href: `/dashboard/crm/budgets/${id}`,
                label: 'Back to budget',
            }}
        >
            <Suspense fallback={<ActivitySkeleton />}>
                <EntityAuditTimeline entityKind="budget" entityId={id} />
            </Suspense>
        </EntityDetailShell>
    );
}
