import { Skeleton } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-9 w-64 mb-6" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    </div>
  );
}
