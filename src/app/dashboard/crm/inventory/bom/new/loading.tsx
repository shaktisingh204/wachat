import { Skeleton } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-6 p-1">
      {/* Header skeleton */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-2">
        <div className="space-y-2">
          <Skeleton className="h-8 w-[150px]" />
          <Skeleton className="h-4 w-[350px]" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Section 1 Skeleton */}
      <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] shadow-sm">
        <div className="border-b border-[var(--st-border)] px-6 py-4">
          <Skeleton className="h-6 w-32 mb-1" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <div className="space-y-2 md:col-span-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>

      {/* Section 2 Skeleton */}
      <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--st-border)] px-6 py-4">
          <div>
            <Skeleton className="h-6 w-32 mb-1" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="p-6">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
      
      {/* Section 3 Skeleton */}
      <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] shadow-sm mb-16">
        <div className="border-b border-[var(--st-border)] px-6 py-4">
          <Skeleton className="h-6 w-32 mb-1" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
