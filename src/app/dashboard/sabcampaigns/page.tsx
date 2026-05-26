import React, { Suspense } from 'react';
import { getDripCampaigns } from '@/app/actions/marketing/drip-campaigns.actions';
import { DripCampaignClient } from './_drip-campaigns-client';
import Loading from './loading';

export const dynamic = 'force-dynamic';

async function DripCampaignsData() {
  const data = await getDripCampaigns();
  return <DripCampaignClient initialData={data} />;
}

export default function DripCampaignPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DripCampaignsData />
    </Suspense>
  );
}
