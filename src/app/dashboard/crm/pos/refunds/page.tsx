import * as React from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getPosRefunds } from '@/app/actions/crm-pos.actions';
import { PosRefundsListClient } from '../_components/pos-refunds-list-client';
import { Skeleton } from '@/components/zoruui/skeleton';

export const dynamic = 'force-dynamic';

async function PosRefundsListContainer() {
    const refunds = await getPosRefunds({ limit: 500 });
    return <PosRefundsListClient refunds={refunds} />;
}

function PosRefundsTableSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            {/* KPI strip skeleton */}
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="rounded-xl border border-zoru-line bg-zoru-surface p-3.5 flex flex-col justify-between h-[80px]"
                    >
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-6 w-24" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter row skeleton */}
            <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-9 w-full max-w-sm" />
                <Skeleton className="h-9 w-[150px]" />
                <Skeleton className="h-9 w-[150px]" />
                <Skeleton className="h-9 w-[150px]" />
                <Skeleton className="h-9 w-[150px]" />
                <div className="ml-auto flex items-center gap-1">
                    <Skeleton className="h-8 w-12" />
                    <Skeleton className="h-8 w-12" />
                </div>
            </div>

            {/* Table skeleton */}
            <div className="rounded-xl border border-zoru-line bg-zoru-surface overflow-hidden">
                <div className="p-4 border-b border-zoru-line flex items-center justify-between">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                </div>
                <div className="divide-y divide-zoru-line">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="p-4 flex items-center justify-between">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-6 w-16 rounded-full" />
                            <Skeleton className="h-4 w-28" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default async function PosRefundsPage() {
    return (
        <EntityListShell
            title="POS refunds"
            subtitle="Refunds processed against POS transactions."
        >
            <React.Suspense fallback={<PosRefundsTableSkeleton />}>
                <PosRefundsListContainer />
            </React.Suspense>
        </EntityListShell>
    );
}

