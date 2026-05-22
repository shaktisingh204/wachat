import React from 'react';
import { getAffiliates } from '@/app/actions/marketing/affiliate-management.actions';
import { AffiliateClient } from './_affiliate-management-client';

export default async function AffiliatePage() {
  const data = await getAffiliates();
  
  return <AffiliateClient initialData={data} />;
}
