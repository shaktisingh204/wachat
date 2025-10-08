
import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';
import { SidebarProvider } from '@/components/ui/sidebar';
import React from 'react';

// This is now a Server Component that renders the client layout.
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
