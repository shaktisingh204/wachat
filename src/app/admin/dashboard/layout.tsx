import { AdminDashboardClientLayout } from '@/components/wabasimplify/admin-dashboard-client-layout';
import React from 'react';

// This is now a Server Component that renders the client layout.
export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminDashboardClientLayout>{children}</AdminDashboardClientLayout>;
}
