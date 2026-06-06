import { Skeleton } from '@/components/sabcrm/20ui';

export default function BatchExpiryLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1 rounded-lg border p-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-2 h-6 w-3/4" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="flex items-center justify-between border-b p-3">
          <Skeleton className="h-9 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <div className="flex gap-3 border-b p-3">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="p-3 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
