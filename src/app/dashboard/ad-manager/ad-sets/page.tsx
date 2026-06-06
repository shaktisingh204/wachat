'use client';

import React, { Suspense } from 'react';
import { Spinner } from '@/components/sabcrm/20ui';
import { CampaignsHub } from '@/components/zoruui-domain/ad-manager/campaigns-hub';

export default function AdSetsListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 p-4 text-[var(--st-text-secondary)]">
          <Spinner size="sm" label="Loading ad sets" />
          <span>Loading ad sets...</span>
        </div>
      }
    >
      <CampaignsHub initialLevel="adset" />
    </Suspense>
  );
}
