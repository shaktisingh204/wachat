import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function MilestonesLoading() {
  return (
    <EntityListShell
      title="Milestones"
      subtitle="Key delivery checkpoints with target dates and payment percentages."
    >
      <div className="flex flex-col gap-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 flex flex-col justify-between h-[80px]">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>

        {/* Filters skeleton */}
        <div className="flex items-center gap-3 py-2">
          <Skeleton className="h-9 w-[160px]" />
          <Skeleton className="h-9 w-[200px]" />
        </div>

        {/* Table skeleton */}
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <div className="p-4 space-y-4">
            <div className="flex justify-between border-b pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between py-2 border-b last:border-0">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </EntityListShell>
  );
}
