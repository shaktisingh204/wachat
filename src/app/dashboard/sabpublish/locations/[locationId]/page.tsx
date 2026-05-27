import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import {
  getSabpublishLocation,
  listSabpublishCitations,
  listSabpublishPosts,
  listSabpublishProfileFields,
  listSabpublishProviders,
  listSabpublishReviews,
  listSabpublishSyncJobs,
} from '@/app/actions/sabpublish.actions';
import {
  SabpublishLocationDetailClient,
  type SabpublishLocationDetailData,
} from './_components/location-detail-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locationId: string }>;
}

async function loadAll(
  locationId: string,
): Promise<SabpublishLocationDetailData | null> {
  const [locationRes, fieldsRes, providersRes, reviewsRes, postsRes, citationsRes, jobsRes] =
    await Promise.all([
      getSabpublishLocation(locationId),
      listSabpublishProfileFields(locationId),
      listSabpublishProviders({ locationId }),
      listSabpublishReviews({ locationId, limit: 100 }),
      listSabpublishPosts({ locationId, limit: 100 }),
      listSabpublishCitations({ locationId, limit: 100 }),
      listSabpublishSyncJobs(locationId),
    ]);

  if (!locationRes.ok) return null;
  return {
    location: locationRes.data,
    profileFields: fieldsRes.ok ? fieldsRes.data.items : [],
    providers: providersRes.ok ? providersRes.data.items : [],
    reviews: reviewsRes.ok ? reviewsRes.data.items : [],
    posts: postsRes.ok ? postsRes.data.items : [],
    citations: citationsRes.ok ? citationsRes.data.items : [],
    syncJobs: jobsRes.ok ? jobsRes.data.items : [],
  };
}

async function LocationDetailData({ locationId }: { locationId: string }) {
  const data = await loadAll(locationId);
  if (!data) notFound();
  return <SabpublishLocationDetailClient data={data} />;
}

export default async function SabpublishLocationDetailPage({
  params,
}: PageProps) {
  const { locationId } = await params;
  return (
    <Suspense fallback={<div className="p-6">Loading location…</div>}>
      <LocationDetailData locationId={locationId} />
    </Suspense>
  );
}
