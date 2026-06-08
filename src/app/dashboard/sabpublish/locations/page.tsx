import { Suspense } from 'react';

import { Card, CardBody, Skeleton } from '@/components/sabcrm/20ui';
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

function LocationsSkeleton() {
  return (
    <div className="20ui space-y-6">
      <div className="space-y-2">
        <Skeleton width={140} height={26} />
        <Skeleton width={360} height={14} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardBody className="space-y-2 p-4">
              <Skeleton width="60%" height={16} />
              <Skeleton width="90%" height={12} />
              <Skeleton width="40%" height={12} />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function SabpublishLocationsPage() {
  return (
    <Suspense fallback={<LocationsSkeleton />}>
      <LocationsData />
    </Suspense>
  );
}
