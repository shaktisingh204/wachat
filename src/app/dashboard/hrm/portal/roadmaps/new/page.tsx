import * as React from 'react';
import { Suspense } from 'react';
import { RoadmapForm } from './_components/roadmap-form';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export const dynamic = 'force-dynamic';


export default function NewRoadmapPage() {
  return (
    <Suspense 
      fallback={
        <div className="mx-auto max-w-2xl p-6 flex flex-col gap-6">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      }
    >
      <RoadmapForm />
    </Suspense>
  );
}
