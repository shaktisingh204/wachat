import React, { Suspense } from 'react';
import { getInboxMessages } from '@/app/actions/marketing/universal-inbox.actions';
import { getDripCampaigns } from '@/app/actions/marketing/drip-campaigns.actions';
import { getUtmLinks } from '@/app/actions/marketing/utm-tracking.actions';
import { getSocialPosts } from '@/app/actions/marketing/social-media-scheduler.actions';
import { UniversalInboxClient } from './_universal-inbox-client';
import Loading from './loading';

export const dynamic = 'force-dynamic';

async function UniversalInboxData() {
  const [messages, campaigns, utmLinks, socialPosts] = await Promise.all([
    getInboxMessages(),
    getDripCampaigns(),
    getUtmLinks(),
    getSocialPosts()
  ]);
  
  return (
    <UniversalInboxClient 
      initialData={messages} 
      campaigns={campaigns} 
      utmLinks={utmLinks} 
      socialPosts={socialPosts} 
    />
  );
}

export default function UniversalInboxPage() {
  return (
    <Suspense fallback={<Loading />}>
      <UniversalInboxData />
    </Suspense>
  );
}
