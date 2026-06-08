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
import { Card, CardBody, Skeleton } from '@/components/sabcrm/20ui';
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
    <Suspense fallback={<LocationDetailSkeleton />}>
      <LocationDetailData locationId={locationId} />
    </Suspense>
  );
}

function LocationDetailSkeleton() {
  return (
    <div className="20ui space-y-6">
      <div className="space-y-2">
        <Skeleton width={220} height={26} />
        <Skeleton width={320} height={14} />
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
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={18} />
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
