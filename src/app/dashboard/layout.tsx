
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
    <Suspense fallback={<Skeleton className="h-screen w-screen" />}>
      <DashboardClientLayout>{children}</DashboardClientLayout>
    </Suspense>
  );
}
