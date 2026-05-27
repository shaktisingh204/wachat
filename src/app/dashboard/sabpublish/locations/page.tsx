import { Suspense } from 'react';

import { listSabpublishLocations } from '@/app/actions/sabpublish.actions';
import { SabpublishLocationsListClient } from './_components/locations-list-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'SabPublish locations | SabNode',
};

async function LocationsData() {
  const res = await listSabpublishLocations({ status: 'all', limit: 100 });
  const items = res.ok && res.data ? res.data.items : [];
  return <SabpublishLocationsListClient initial={items} />;
}

export default function SabpublishLocationsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading locations…</div>}>
      <LocationsData />
    </Suspense>
  );
}
