import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export default function NewReconciliationLoading() {
    return (
        <EntityDetailShell
            eyebrow="RECONCILIATION"
            title="New Reconciliation"
            back={{ href: '/dashboard/crm/banking/reconciliation', label: 'Reconciliation' }}
        >
            <div className="rounded-xl border bg-[var(--st-bg-secondary)] text-[var(--st-text)] shadow-sm p-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-24 w-full" />
                <div className="flex justify-between pt-2">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-40" />
                </div>
            </div>
        </EntityDetailShell>
    );
}
