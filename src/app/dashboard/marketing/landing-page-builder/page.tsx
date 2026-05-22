import React from 'react';
import { getLandingPages } from '@/app/actions/marketing/landing-page-builder.actions';
import { LandingPageClient } from './_landing-page-builder-client';

export default async function LandingPagePage() {
  const data = await getLandingPages();
  
  return <LandingPageClient initialData={data} />;
}
