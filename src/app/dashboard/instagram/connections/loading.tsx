import { Skeleton } from '@/components/sabcrm/20ui/compat';

export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>
      <div className="flex justify-between items-center bg-zoru-surface p-4 rounded-lg border">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  );
}
