import { Skeleton } from '@/components/sabcrm/20ui/compat';

export default function AutomateLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-8 w-1/4" />
      <Skeleton className="h-4 w-1/3 mb-4" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
