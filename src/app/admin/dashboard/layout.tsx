'use client';

import { Suspense } from 'react';
import { AdminDashboardClientLayout } from '@/components/wabasimplify/admin-dashboard-client-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Suspense fallback={<Skeleton className="h-screen w-screen" />}>
        <AdminDashboardClientLayout>{children}</AdminDashboardClientLayout>
      </Suspense>
    </SidebarProvider>
  );
}
