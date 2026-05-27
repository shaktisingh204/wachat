import { Suspense } from 'react';

import {
  listSabpublishLocations,
  listSabpublishProviders,
  listSabpublishReviews,
  listSabpublishSyncJobs,
} from '@/app/actions/sabpublish.actions';
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

export default function SabpublishPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading SabPublish…</div>}>
      <SabpublishOverviewLoader />
    </Suspense>
  );
}
