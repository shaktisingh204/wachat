'use client';

import React, { Suspense } from 'react';
import { cn } from '@/lib/utils';
import { CampaignsHub } from '@/components/zoruui-domain/ad-manager/campaigns-hub';

export default function AdSetsListPage() {
  return (
    <div className={cn('zoruui')}>
      <Suspense fallback={<div className="p-4">Loading ad sets...</div>}>
        <CampaignsHub initialLevel="adset" />
      </Suspense>
    </div>
  );
}
