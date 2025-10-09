'use client';

import * as React from 'react';
import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';

export default function RootDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}
