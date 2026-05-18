'use client';

import { cn } from '@/components/zoruui';
import { CampaignsHub } from '@/components/wabasimplify/ad-manager/campaigns-hub';

export default function AdSetsListPage() {
  return (
    <div className={cn('zoruui')}>
      <CampaignsHub initialLevel="adset" />
    </div>
  );
}
