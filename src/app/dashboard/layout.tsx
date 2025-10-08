
import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';
import { SidebarProvider } from '@/components/ui/sidebar';
import React from 'react';

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
