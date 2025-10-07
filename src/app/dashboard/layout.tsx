
import { Suspense } from 'react';
import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarProvider } from '@/components/ui/sidebar';

function FullPageSkeleton() {
    return (
      <div className="flex h-screen w-screen">
        {/* Sidebar Rail */}
        <div className="hidden md:flex w-16 border-r p-2 bg-muted/30"><Skeleton className="h-full w-full"/></div>
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
      <SidebarProvider>
        <DashboardClientLayout>
            {children}
        </DashboardClientLayout>
      </SidebarProvider>
    </Suspense>
  );
}
