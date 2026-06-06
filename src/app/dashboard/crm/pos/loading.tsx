import { Skeleton } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function PosLoading() {
  return (
    <EntityListShell
      title="Point of Sale"
      subtitle="Run shifts, ring up sales, recall held tickets and process refunds."
    >
      <div className="flex flex-col gap-6">
        {/* Headline KPI strip — 5 cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
          <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
          <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
          <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
          <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
        </div>

        {/* Secondary KPI strip — 4 cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
          <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
          <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
          <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
        </div>

        {/* Quick Actions Skeleton */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Skeleton className="h-20 w-full rounded-xl animate-pulse" />
          <Skeleton className="h-20 w-full rounded-xl animate-pulse" />
          <Skeleton className="h-20 w-full rounded-xl animate-pulse" />
        </div>

        {/* Graph Skeleton */}
        <Skeleton className="h-[300px] w-full rounded-xl animate-pulse" />

        {/* Split transactions/refunds columns */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full rounded-xl animate-pulse" />
          </div>
          <div>
            <Skeleton className="h-96 w-full rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </EntityListShell>
  );
}
