import { Skeleton } from '@/components/sabcrm/20ui/compat';

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-[var(--st-radius)]" />
        ))}
      </div>
      <Skeleton className="h-[400px] w-full rounded-[var(--st-radius)]" />
    </div>
  );
}
