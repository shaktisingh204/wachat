import React from 'react';
import { getDripCampaigns } from '@/app/actions/marketing/drip-campaigns.actions';
import { DripCampaignClient } from './_drip-campaigns-client';

export default async function DripCampaignPage() {
  const data = await getDripCampaigns();
  
  return <DripCampaignClient initialData={data} />;
}
