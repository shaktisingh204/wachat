'use client';

import { CampaignsHub } from '@/components/wabasimplify/ad-manager/campaigns-hub';
import { cn } from '@/components/zoruui';

export default function AdsListPage() {
  return (
    <div className={cn('zoruui')}>
      <CampaignsHub initialLevel="ad" />
    </div>
  );
}
