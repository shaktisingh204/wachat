import { getCrmDashboardStats } from '@/app/actions/crm.actions';
import { getPinnedQuickList } from '@/app/actions/worksuite/dashboard.actions';
import { CrmDashboardClient } from './_components/crm-dashboard-client';
import React from 'react';
import type { WsPinnedItem } from '@/lib/worksuite/dashboard-types';
import CrmDashboardLoading from './loading';

export const dynamic = 'force-dynamic';

async function CrmDashboardContent() {
  const [stats, pinned] = await Promise.all([
    getCrmDashboardStats(),
    getPinnedQuickList(6).catch(() => [])
  ]);

  return (
    <CrmDashboardClient 
      initialStats={stats} 
      initialPinned={pinned as (WsPinnedItem & { _id: string })[]} 
    />
  );
}

export default function CrmDashboardPage() {
  return (
    <React.Suspense fallback={<CrmDashboardLoading />}>
      <CrmDashboardContent />
    </React.Suspense>
  );
}
