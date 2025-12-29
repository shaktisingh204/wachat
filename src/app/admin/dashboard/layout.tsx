import React, { Suspense } from 'react';
import { AdminDashboardClientLayout } from '@/components/wabasimplify/admin-dashboard-client-layout';
import { Skeleton } from '@/components/ui/skeleton';

function FullPageSkeleton() {
    return (
        <div className="flex h-screen w-screen bg-background p-2 gap-2">
            <div className="w-60 rounded-lg bg-card p-2"><Skeleton className="h-full w-full"/></div>
            <div className="flex-1 flex flex-col gap-2">
                <div className="h-16 rounded-lg bg-card p-4"><Skeleton className="h-full w-full"/></div>
                <div className="flex-1 rounded-lg bg-card p-4"><Skeleton className="h-full w-full"/></div>
            </div>
        </div>
    );
}


export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<FullPageSkeleton />}>
        <AdminDashboardClientLayout>{children}</AdminDashboardClientLayout>
    </Suspense>
  )
}
