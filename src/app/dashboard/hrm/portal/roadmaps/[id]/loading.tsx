import { Skeleton } from '@/components/sabcrm/20ui/compat';

export default function RoadmapLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-zoru-line px-6 py-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="ml-auto h-8 w-20" />
      </div>
      <div className="flex flex-1 gap-4 p-6 overflow-hidden">
        <Skeleton className="h-full w-72 shrink-0 rounded-[var(--zoru-radius-lg)]" />
        <Skeleton className="h-full w-72 shrink-0 rounded-[var(--zoru-radius-lg)]" />
        <Skeleton className="h-full w-72 shrink-0 rounded-[var(--zoru-radius-lg)]" />
      </div>
    </div>
  );
}
