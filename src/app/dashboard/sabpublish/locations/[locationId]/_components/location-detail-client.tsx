'use client';

import * as React from 'react';
import Link from 'next/link';

import { Badge, PageHeader, Tabs, PageDescription, PageHeading, PageTitle, TabsContent, TabsList, TabsTrigger } from '@/components/sabcrm/20ui';
import type { SabpublishLocationDoc } from '@/lib/rust-client/sabpublish-locations';
import type { SabpublishProfileFieldDoc } from '@/lib/rust-client/sabpublish-profile-fields';
import type { SabpublishProviderDoc } from '@/lib/rust-client/sabpublish-providers';
import type { SabpublishReviewDoc } from '@/lib/rust-client/sabpublish-reviews';
import type { SabpublishPostDoc } from '@/lib/rust-client/sabpublish-posts';
import type { SabpublishCitationDoc } from '@/lib/rust-client/sabpublish-citations';
import type { SabpublishSyncJobDoc } from '@/lib/rust-client/sabpublish-sync-jobs';

import { SabpublishProfileTab } from './profile-tab';
import { SabpublishProvidersTab } from './providers-tab';
import { SabpublishReviewsTab } from './reviews-tab';
import { SabpublishPostsTab } from './posts-tab';
import { SabpublishCitationsTab } from './citations-tab';
import { SabpublishSyncHistoryTab } from './sync-history-tab';

export interface SabpublishLocationDetailData {
  location: SabpublishLocationDoc;
  profileFields: SabpublishProfileFieldDoc[];
  providers: SabpublishProviderDoc[];
  reviews: SabpublishReviewDoc[];
  posts: SabpublishPostDoc[];
  citations: SabpublishCitationDoc[];
  syncJobs: SabpublishSyncJobDoc[];
}

export function SabpublishLocationDetailClient({
  data,
}: {
  data: SabpublishLocationDetailData;
}) {
  const { location } = data;
  return (
    <div className="zoruui space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>{location.name}</PageTitle>
          <PageDescription>
            {[location.addressLine1, location.city, location.region]
              .filter(Boolean)
              .join(', ') || 'No address yet'}
          </PageDescription>
        </PageHeading>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{location.status ?? 'draft'}</Badge>
          <Link
            href="/dashboard/sabpublish/locations"
            className="text-sm underline-offset-2 hover:underline"
          >
            Back to locations
          </Link>
        </div>
      </PageHeader>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="citations">Citations</TabsTrigger>
          <TabsTrigger value="history">Sync history</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="pt-4">
          <SabpublishProfileTab
            locationId={location._id}
            initial={data.profileFields}
          />
        </TabsContent>
        <TabsContent value="providers" className="pt-4">
          <SabpublishProvidersTab
            locationId={location._id}
            initial={data.providers}
          />
        </TabsContent>
        <TabsContent value="reviews" className="pt-4">
          <SabpublishReviewsTab initial={data.reviews} />
        </TabsContent>
        <TabsContent value="posts" className="pt-4">
          <SabpublishPostsTab
            locationId={location._id}
            initial={data.posts}
          />
        </TabsContent>
        <TabsContent value="citations" className="pt-4">
          <SabpublishCitationsTab
            locationId={location._id}
            initial={data.citations}
          />
        </TabsContent>
        <TabsContent value="history" className="pt-4">
          <SabpublishSyncHistoryTab initial={data.syncJobs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
