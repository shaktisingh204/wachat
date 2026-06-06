import { LoaderCircle } from 'lucide-react';
import { Skeleton, StatCard, Card } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Skeleton className="h-12 w-64 rounded-md" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[var(--st-radius)]" />
        ))}
      </div>
      <Skeleton className="h-9 w-64 rounded-md" />
      <Card className="p-0">
        <Skeleton className="h-[400px] w-full rounded-[var(--st-radius)]" />
      </Card>
    </div>
  );
}
