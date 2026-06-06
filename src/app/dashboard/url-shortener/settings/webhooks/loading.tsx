import { Skeleton } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="w-full p-6 space-y-6 animate-in fade-in duration-500">
      <div className="space-y-2">
        <Skeleton height={32} width={250} />
        <Skeleton height={16} width={350} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="w-full" height={128} radius="var(--st-radius)" />
        <Skeleton className="w-full" height={128} radius="var(--st-radius)" />
        <Skeleton className="w-full" height={128} radius="var(--st-radius)" />
        <Skeleton className="w-full" height={128} radius="var(--st-radius)" />
      </div>
      <div className="space-y-4 mt-8">
        <Skeleton className="w-full" height={48} />
        <Skeleton className="w-full" height={48} />
        <Skeleton className="w-full" height={48} />
      </div>
    </div>
  );
}
