
'use client';

import * as React from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';

export default function RootDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardClientLayout>{children}</DashboardClientLayout>
    </SidebarProvider>
  );
}
