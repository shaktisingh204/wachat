import * as React from 'react';
import { Skeleton } from '@/components/zoruui';

export default function Loading() {
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-[150px]" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col space-y-4 rounded-xl border border-zoru-line p-6">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex flex-col space-y-4 rounded-xl border border-zoru-line p-6">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
