import { PageHeader, Skeleton } from '@/components/sabcrm/20ui';

export default function ProductionOrdersLoading() {
  return (
    <div className="flex flex-col h-full w-full">
      <PageHeader
        title="Production Orders"
        description="Loading production orders..."
      />
      <div className="p-6 space-y-6 flex-1 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}
