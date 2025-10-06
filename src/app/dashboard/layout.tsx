
import { Suspense } from 'react';
import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';
import { Skeleton } from '@/components/ui/skeleton';

function FullPageSkeleton() {
    return (
      <div className="flex h-screen w-screen bg-background">
        {/* Sidebar Rail */}
        <div className="w-16 border-r p-2 space-y-2">
            <Skeleton className="h-8 w-8 mx-auto rounded-full"/>
            <Skeleton className="h-10 w-10 mx-auto rounded-lg"/>
            <Skeleton className="h-10 w-10 mx-auto rounded-lg"/>
            <Skeleton className="h-10 w-10 mx-auto rounded-lg"/>
        </div>
        {/* Secondary Sidebar */}
        <div className="w-60 border-r p-2 flex flex-col">
          <Skeleton className="h-10 w-full mb-4"/>
          <Skeleton className="h-8 w-full mb-2"/>
          <Skeleton className="h-8 w-full mb-2"/>
          <Skeleton className="h-8 w-full mb-2"/>
          <div className="mt-auto"><Skeleton className="h-12 w-full"/></div>
        </div>
        <div className="flex-1 flex flex-col">
            <div className="h-16 border-b p-4"><Skeleton className="h-full w-full"/></div>
            <div className="h-12 border-b p-2"><Skeleton className="h-full w-full"/></div>
            <div className="flex-1 p-4"><Skeleton className="h-full w-full"/></div>
        </div>
      </div>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<FullPageSkeleton />}>
        <DashboardClientLayout>
            {children}
        </DashboardClientLayout>
    </Suspense>
  );
}
