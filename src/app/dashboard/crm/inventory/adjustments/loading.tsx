import { Skeleton } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function AdjustmentsLoading() {
    return (
        <EntityListShell
            title="Stock Adjustments"
            subtitle="Manage additions, subtractions, or damages to your inventory."
        >
            <div className="flex flex-col gap-6">
                {/* KPI Cards Skeleton */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-xl border p-6 flex flex-col justify-between h-[120px]">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-8 w-32" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters and Search Skeleton */}
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-[250px]" />
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>

                {/* Table Skeleton */}
                <div className="rounded-xl border p-6">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center pb-4 border-b">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-5 w-24" />
                        </div>
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="flex justify-between items-center py-3 border-b last:border-0">
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-40" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-8 w-8 rounded-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </EntityListShell>
    );
}
