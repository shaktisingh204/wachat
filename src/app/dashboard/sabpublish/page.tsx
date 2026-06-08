import { Suspense } from 'react';

import {
  listSabpublishLocations,
  listSabpublishProviders,
  listSabpublishReviews,
  listSabpublishSyncJobs,
} from '@/app/actions/sabpublish.actions';
import { Card, CardBody, Skeleton } from '@/components/sabcrm/20ui';
import {
  SabpublishOverviewClient,
  type SabpublishOverviewData,
} from './_components/overview-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'SabPublish | SabNode',
};

async function loadOverview(): Promise<SabpublishOverviewData> {
  const [locationsRes, providersRes, reviewsRes] = await Promise.all([
    listSabpublishLocations({ limit: 50 }),
    listSabpublishProviders(),
    listSabpublishReviews({ filter: 'unreplied', limit: 200 }),
  ]);

  const locations =
    locationsRes.ok && locationsRes.data ? locationsRes.data.items : [];
  const providers =
    providersRes.ok && providersRes.data ? providersRes.data.items : [];
  const unrepliedReviewCount =
    reviewsRes.ok && reviewsRes.data ? reviewsRes.data.items.length : 0;

  // Pull recent jobs across the first handful of locations.
  const jobLists = await Promise.all(
    locations.slice(0, 10).map((l) => listSabpublishSyncJobs(l._id)),
  );
  const recentJobs = jobLists
    .flatMap((r) => (r.ok && r.data ? r.data.items : []))
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );

  return { locations, providers, recentJobs, unrepliedReviewCount };
}

async function SabpublishOverviewLoader() {
  const data = await loadOverview();
  return <SabpublishOverviewClient data={data} />;
}

function OverviewSkeleton() {
  return (
    <div className="20ui space-y-6">
      <div className="space-y-2">
        <Skeleton width={180} height={26} />
        <Skeleton width={420} height={14} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardBody className="space-y-3 p-4">
              <Skeleton circle width={32} height={32} />
              <Skeleton width="50%" height={12} />
              <Skeleton width="70%" height={20} />
            </CardBody>
          </Card>
        ))}
      </div>
      <Card>
        <CardBody className="space-y-3 p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={16} />
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

export default function SabpublishPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <SabpublishOverviewLoader />
    </Suspense>
  );
}
