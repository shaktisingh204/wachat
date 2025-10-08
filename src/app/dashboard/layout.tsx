
import { Suspense } from 'react';
import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';
import { Skeleton } from '@/components/ui/skeleton';


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-screen" />}>
        <DashboardClientLayout>
            {children}
        </DashboardClientLayout>
    </Suspense>
  );
}
