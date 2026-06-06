import { Skeleton } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading bio links"
      aria-busy="true"
      className="ui20 w-full p-6 space-y-6 animate-in fade-in duration-500"
    >
      <span className="sr-only">Loading bio links</span>

      {/* Page header placeholder */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-[250px] rounded-[var(--st-radius)]" />
        <Skeleton className="h-4 w-[350px] rounded-[var(--st-radius)]" />
      </div>

      {/* Stat cards row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-[var(--st-radius-lg)]" />
        ))}
      </div>

      {/* Link rows */}
      <div className="space-y-4 mt-8">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-[var(--st-radius)]" />
        ))}
      </div>
    </div>
  );
}
