import { Skeleton } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function SubtasksLoading() {
  return (
    <EntityListShell
      title="Subtasks"
      subtitle="Break tasks into smaller actionable items, assign them, and track progress."
    >
      <div className="flex flex-col gap-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between py-2 border-b last:border-0">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </EntityListShell>
  );
}
