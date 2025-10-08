
import { Suspense } from 'react';
import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';
import { Skeleton } from '@/components/ui/skeleton';


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The main layout now only needs a very simple suspense boundary.
  // The full page skeleton and provider logic is correctly handled within the client layout.
  return (
    <Suspense fallback={<Skeleton className="h-screen w-screen" />}>
        <DashboardClientLayout>
            {children}
        </DashboardClientLayout>
    </Suspense>
  );
}
