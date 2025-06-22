
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import CreateTemplateClientPage from './client-page';

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 mt-2 w-96" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="lg:col-span-1 space-y-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function CreateTemplatePage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <CreateTemplateClientPage />
    </Suspense>
  );
}
