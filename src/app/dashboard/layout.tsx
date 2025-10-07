
import { Suspense } from 'react';
import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarProvider } from '@/components/ui/sidebar';

function FullPageSkeleton() {
    return (
      <div className="flex h-screen w-screen bg-background">
        <div className="w-16 border-r bg-muted/30 p-2"><Skeleton className="h-full w-full"/></div>
        <div className="flex-1 flex flex-col">
            <div className="h-16 border-b p-4"><Skeleton className="h-full w-full"/></div>
            <div className="flex-1 p-4"><Skeleton className="h-full w-full"/></div>
        </div>
      </div>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
        <Suspense fallback={<FullPageSkeleton />}>
            <DashboardClientLayout>
                {children}
            </DashboardClientLayout>
        </Suspense>
    </SidebarProvider>
  );
}
