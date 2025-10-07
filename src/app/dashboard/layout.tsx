
import { Suspense } from 'react';
import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';

// This is a server component that establishes the layout for the dashboard section.
// It uses Suspense to handle the client-side data fetching within DashboardClientLayout.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardClientLayout.Skeleton />}>
        <DashboardClientLayout>
            {children}
        </DashboardClientLayout>
    </Suspense>
  );
}
