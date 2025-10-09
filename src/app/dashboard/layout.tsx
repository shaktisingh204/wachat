'use client';

import * as React from 'react';
import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';

// This is now a Server Component that renders the client layout.
export default function RootDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}
