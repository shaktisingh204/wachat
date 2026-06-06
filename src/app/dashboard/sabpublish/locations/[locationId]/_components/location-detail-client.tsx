'use client';

import * as React from 'react';
import Link from 'next/link';

import {
  Badge,
  PageHeader,
  Tabs,
  ZoruPageDescription,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruTabsContent,
  ZoruTabsList,
  ZoruTabsTrigger,
} from '@/components/sabcrm/20ui/compat';
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
        <ZoruPageHeading>
          <ZoruPageTitle>{location.name}</ZoruPageTitle>
          <ZoruPageDescription>
            {[location.addressLine1, location.city, location.region]
              .filter(Boolean)
              .join(', ') || 'No address yet'}
          </ZoruPageDescription>
        </ZoruPageHeading>
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
        <ZoruTabsList>
          <ZoruTabsTrigger value="profile">Profile</ZoruTabsTrigger>
          <ZoruTabsTrigger value="providers">Providers</ZoruTabsTrigger>
          <ZoruTabsTrigger value="reviews">Reviews</ZoruTabsTrigger>
          <ZoruTabsTrigger value="posts">Posts</ZoruTabsTrigger>
          <ZoruTabsTrigger value="citations">Citations</ZoruTabsTrigger>
          <ZoruTabsTrigger value="history">Sync history</ZoruTabsTrigger>
        </ZoruTabsList>

        <ZoruTabsContent value="profile" className="pt-4">
          <SabpublishProfileTab
            locationId={location._id}
            initial={data.profileFields}
          />
        </ZoruTabsContent>
        <ZoruTabsContent value="providers" className="pt-4">
          <SabpublishProvidersTab
            locationId={location._id}
            initial={data.providers}
          />
        </ZoruTabsContent>
        <ZoruTabsContent value="reviews" className="pt-4">
          <SabpublishReviewsTab initial={data.reviews} />
        </ZoruTabsContent>
        <ZoruTabsContent value="posts" className="pt-4">
          <SabpublishPostsTab
            locationId={location._id}
            initial={data.posts}
          />
        </ZoruTabsContent>
        <ZoruTabsContent value="citations" className="pt-4">
          <SabpublishCitationsTab
            locationId={location._id}
            initial={data.citations}
          />
        </ZoruTabsContent>
        <ZoruTabsContent value="history" className="pt-4">
          <SabpublishSyncHistoryTab initial={data.syncJobs} />
        </ZoruTabsContent>
      </Tabs>
    </div>
  );
}
