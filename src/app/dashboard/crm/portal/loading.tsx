import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function PortalLoading() {
  return (
    <EntityListShell
      title="Customer Portal"
      subtitle="Self-service portal where customers see invoices, tickets and documents."
    >
      <div className="flex flex-col gap-4">
        {/* KPI Strip Skeletons */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>

        {/* Filter controls skeleton */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>

        {/* Table skeleton */}
        <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    </EntityListShell>
  );
}
