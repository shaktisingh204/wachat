
'use client';

import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';
import React, { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <DashboardClientLayout>{children}</DashboardClientLayout>
  );
}
