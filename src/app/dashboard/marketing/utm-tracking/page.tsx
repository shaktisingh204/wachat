import React from 'react';
import { getUtmLinks } from '@/app/actions/marketing/utm-tracking.actions';
import { UtmLinkClient } from './_utm-tracking-client';

export default async function UtmLinkPage() {
  const data = await getUtmLinks();
  
  return <UtmLinkClient initialData={data} />;
}
