
import { Suspense } from 'react';
import { AdminDashboardClientLayout } from '@/components/wabasimplify/admin-dashboard-client-layout';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-screen" />}>
      <AdminDashboardClientLayout>
        {children}
      </AdminDashboardClientLayout>
    </Suspense>
  );
}
