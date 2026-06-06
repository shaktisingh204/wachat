import { Skeleton } from '@/components/sabcrm/20ui';

export default function SabcrmObjectIndexLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      {/* Header skeleton */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Skeleton width="12rem" height="2rem" className="mb-2" />
          <Skeleton width="18rem" height="1rem" />
        </div>
        <Skeleton width="8rem" height="2.5rem" />
      </div>

      {/* Toolbar skeleton */}
      <div className="mb-4 flex flex-col gap-3">
        {/* Search + View switch row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton height="2.5rem" className="w-full max-w-sm" />
          <div className="flex items-center gap-3">
            <Skeleton width="4rem" height="1.5rem" />
            <Skeleton width={220} height="2.25rem" />
          </div>
        </div>

        {/* Sort + Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton width={170} height="2.25rem" />
          <Skeleton width={120} height="2.25rem" />
          <Skeleton width={160} height="2.25rem" />
          <Skeleton width={170} height="2.25rem" />
          <Skeleton width={160} height="2.25rem" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-[var(--st-border)]">
        <div className="space-y-0">
          {/* Table header */}
          <div className="flex border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-6 py-3">
            <Skeleton width="8rem" height="1rem" />
            <div className="ml-auto flex gap-6">
              <Skeleton width="6rem" height="1rem" />
              <Skeleton width="6rem" height="1rem" />
              <Skeleton width="5rem" height="1rem" />
            </div>
          </div>

          {/* Table rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex border-b border-[var(--st-border)] px-6 py-4 last:border-b-0"
            >
              <Skeleton width="10rem" height="1.25rem" />
              <div className="ml-auto flex gap-6">
                <Skeleton width="6rem" height="1.25rem" />
                <Skeleton width="6rem" height="1.25rem" />
                <Skeleton width="5rem" height="1.25rem" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination skeleton */}
      <div className="mt-4 flex items-center justify-between">
        <Skeleton width="6.25rem" height="2.25rem" />
        <Skeleton width="4rem" height="1.25rem" />
        <Skeleton width="6.25rem" height="2.25rem" />
      </div>
    </main>
  );
}
