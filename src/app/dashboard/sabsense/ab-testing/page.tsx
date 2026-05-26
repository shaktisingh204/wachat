import React from 'react';
import { getAbTests } from '@/app/actions/marketing/ab-testing.actions';
import { AbTestClient } from './_ab-testing-client';

export default async function AbTestPage() {
  const data = await getAbTests();
  
  return <AbTestClient initialData={data} />;
}
