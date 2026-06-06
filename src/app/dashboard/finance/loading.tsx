import React from 'react';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export default function Loading() {
  return (
    <div className="p-8 space-y-4">
      <Skeleton className="h-10 w-[200px]" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}
