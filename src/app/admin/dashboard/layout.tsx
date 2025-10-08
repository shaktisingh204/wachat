
'use client';

import { Suspense } from 'react';
import { AdminDashboardClientLayout } from '@/components/wabasimplify/admin-dashboard-client-layout';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminDashboardClientLayout>
      <Suspense fallback={<Skeleton className="h-full w-full" />}>
        {children}
      </Suspense>
    </AdminDashboardClientLayout>
  );
}
