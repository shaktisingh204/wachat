import React, { Suspense } from 'react';
import { getUtmLinks } from '@/app/actions/marketing/utm-tracking.actions';
import { UtmLinkClient } from './_utm-tracking-client';
import Loading from './loading';

export const dynamic = 'force-dynamic';

async function UtmLinksData() {
  const data = await getUtmLinks();
  return <UtmLinkClient initialData={data} />;
}

export default function UtmLinkPage() {
  return (
    <Suspense fallback={<Loading />}>
      <UtmLinksData />
    </Suspense>
  );
}
