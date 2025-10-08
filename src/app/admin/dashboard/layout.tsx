'use client';

import { AdminDashboardClientLayout } from '@/components/wabasimplify/admin-dashboard-client-layout';
import React from 'react';

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <AdminDashboardClientLayout>{children}</AdminDashboardClientLayout>
  );
}
