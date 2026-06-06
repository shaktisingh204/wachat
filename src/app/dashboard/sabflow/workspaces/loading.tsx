import { Skeleton } from '@/components/sabcrm/20ui';

export default function SabFlowWorkspacesLoading() {
  return (
    <div className="min-h-screen bg-[var(--st-text)] text-white p-6">
      <Skeleton className="h-8 w-64 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
