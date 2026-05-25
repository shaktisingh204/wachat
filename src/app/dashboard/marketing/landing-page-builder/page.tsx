import React, { Suspense } from 'react';
import { getLandingPages } from '@/app/actions/marketing/landing-page-builder.actions';
import { LandingPageClient } from './_landing-page-builder-client';
import Loading from './loading';

export const dynamic = 'force-dynamic';

async function LandingPagesData() {
  const data = await getLandingPages();
  return <LandingPageClient initialData={data} />;
}

export default function LandingPagePage() {
  return (
    <Suspense fallback={<Loading />}>
      <LandingPagesData />
    </Suspense>
  );
}
