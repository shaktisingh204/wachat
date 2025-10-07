
import { Suspense } from 'react';
import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';
import { Skeleton } from '@/components/ui/skeleton';

function FullPageSkeleton() {
    return (
      <div className="flex h-screen w-screen bg-background">
        <div className="w-16 border-r bg-muted/30 p-2"><Skeleton className="h-full w-full"/></div>
        <div className="hidden md:block w-60 border-r bg-muted/30 p-2"><Skeleton className="h-full w-full"/></div>
        <div className="flex-1 flex flex-col">
            <div className="h-16 border-b p-4"><Skeleton className="h-full w-full"/></div>
            <div className="h-12 border-b p-2"><Skeleton className="h-full w-full"/></div>
            <div className="flex-1 p-4"><Skeleton className="h-full w-full"/></div>
        </div>
      </div>
    );
};


// This is a server component that establishes the layout for the dashboard section.
// It uses Suspense to handle the client-side data fetching within DashboardClientLayout.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardClientLayout>
        {children}
    </DashboardClientLayout>
  );
}
