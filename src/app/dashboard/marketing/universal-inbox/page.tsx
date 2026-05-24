import React from 'react';
import { getInboxMessages } from '@/app/actions/marketing/universal-inbox.actions';
import { getDripCampaigns } from '@/app/actions/marketing/drip-campaigns.actions';
import { UniversalInboxClient } from './_universal-inbox-client';

export default async function UniversalInboxPage() {
  const [messages, campaigns] = await Promise.all([
    getInboxMessages(),
    getDripCampaigns()
  ]);
  
  return <UniversalInboxClient initialData={messages} campaigns={campaigns} />;
}
