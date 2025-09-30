
'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardLayoutClient } from '@/components/wabasimplify/dashboard-layout-client';


function FullPageSkeleton() {
    return (
      <div className="flex h-screen w-screen">
        <div className="hidden md:flex w-16 border-r p-2"><Skeleton className="h-full w-full"/></div>
        <div className="w-72 border-r p-2 hidden md:block"><Skeleton className="h-full w-full"/></div>
        <div className="flex-1 flex flex-col">
            <div className="h-16 border-b p-4"><Skeleton className="h-full w-full"/></div>
            <div className="flex-1 p-4"><Skeleton className="h-full w-full"/></div>
        </div>
      </div>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<FullPageSkeleton />}>
        <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </Suspense>
  );
}
