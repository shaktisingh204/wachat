import React, { Suspense } from 'react';
import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';
import { Skeleton } from '@/components/ui/skeleton';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | SabNode',
  description: 'Manage your projects and communications.',
};

export function generateViewport(): Viewport {
  return {
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: 'white' },
      { media: '(prefers-color-scheme: dark)', color: 'black' },
    ],
  };
}

export default function RootDashboardLayout({
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
