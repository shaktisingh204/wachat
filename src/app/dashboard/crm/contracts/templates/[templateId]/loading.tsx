import { Skeleton } from '@/components/sabcrm/20ui';

export default function ContractTemplateLoading() {
  return (
    <div className="flex w-full flex-col gap-6 p-6">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Main Content Skeleton */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Skeleton className="h-[200px] w-full rounded-md" />
          <Skeleton className="h-[400px] w-full rounded-md" />
          <Skeleton className="h-[150px] w-full rounded-md" />
        </div>
        
        {/* Right Rail Skeleton */}
        <div className="flex flex-col gap-6">
          <Skeleton className="h-[120px] w-full rounded-md" />
          <Skeleton className="h-[120px] w-full rounded-md" />
          <Skeleton className="h-[120px] w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
