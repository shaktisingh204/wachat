import { Skeleton } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="w-full p-6 space-y-6 animate-in fade-in duration-500">
      <div className="space-y-2">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-4 w-[350px]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 w-full" radius="var(--st-radius-lg)" />
        <Skeleton className="h-32 w-full" radius="var(--st-radius-lg)" />
        <Skeleton className="h-32 w-full" radius="var(--st-radius-lg)" />
        <Skeleton className="h-32 w-full" radius="var(--st-radius-lg)" />
      </div>
      <div className="space-y-4 mt-8">
        <Skeleton className="h-12 w-full" radius="var(--st-radius)" />
        <Skeleton className="h-12 w-full" radius="var(--st-radius)" />
        <Skeleton className="h-12 w-full" radius="var(--st-radius)" />
      </div>
    </div>
  );
}
