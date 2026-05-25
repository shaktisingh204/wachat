'use client';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Skeleton } from '@/components/zoruui';
import { useParams } from 'next/navigation';

export default function BudgetActivityLoading() {
    const params = useParams();
    const id = params?.id as string;

    return (
        <EntityDetailShell
            title="Loading Activity..."
            eyebrow="BUDGET ACTIVITY"
            back={{
                href: id ? `/dashboard/crm/budgets/${id}` : '/dashboard/crm/budgets',
                label: 'Back to budget',
            }}
        >
            <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
            </div>
        </EntityDetailShell>
    );
}
