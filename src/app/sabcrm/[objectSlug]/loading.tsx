import { Skeleton } from '@/components/zoruui';

export default function SabcrmObjectIndexLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      {/* Header skeleton */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Toolbar skeleton */}
      <div className="mb-4 flex flex-col gap-3">
        {/* Search + View switch row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-10 w-full max-w-sm" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-9 w-[220px]" />
          </div>
        </div>

        {/* Sort + Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-[170px]" />
          <Skeleton className="h-9 w-[120px]" />
          <Skeleton className="h-9 w-[160px]" />
          <Skeleton className="h-9 w-[170px]" />
          <Skeleton className="h-9 w-[160px]" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-zoru-line">
        <div className="space-y-0">
          {/* Table header */}
          <div className="flex border-b border-zoru-line bg-zoru-surface px-6 py-3">
            <Skeleton className="h-4 w-32" />
            <div className="ml-auto flex gap-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>

          {/* Table rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex border-b border-zoru-line px-6 py-4 last:border-b-0"
            >
              <Skeleton className="h-5 w-40" />
              <div className="ml-auto flex gap-6">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination skeleton */}
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-9 w-[100px]" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-9 w-[100px]" />
      </div>
    </main>
  );
}
