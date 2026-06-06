'use client';

import { Skeleton } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-12" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
