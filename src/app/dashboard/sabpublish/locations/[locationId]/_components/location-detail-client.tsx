'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plug,
  Star,
  Megaphone,
  Link2,
  History,
  UserSquare,
} from 'lucide-react';

import {
  Badge,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  StatCard,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
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

function statusTone(status: string | undefined): BadgeTone {
  switch ((status ?? 'draft').toLowerCase()) {
    case 'active':
      return 'success';
    case 'paused':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function SabpublishLocationDetailClient({
  data,
}: {
  data: SabpublishLocationDetailData;
}) {
  const { location } = data;

  const connectedProviders = data.providers.filter(
    (p) => p.connectionStatus === 'connected',
  ).length;
  const unrepliedReviews = data.reviews.filter((r) => !r.replyBody).length;

  return (
    <div className="20ui space-y-6">
      <PageHeader>
        <PageHeading>
          <div className="flex items-center gap-2">
            <PageTitle>{location.name}</PageTitle>
            <Badge tone={statusTone(location.status)}>
              {location.status ?? 'draft'}
            </Badge>
          </div>
          <PageDescription>
            {[location.addressLine1, location.city, location.region]
              .filter(Boolean)
              .join(', ') || 'No address yet'}
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="ghost" iconLeft={ArrowLeft} asChild>
            <Link href="/dashboard/sabpublish/locations">Back to locations</Link>
          </Button>
        </PageActions>
      </PageHeader>

      <section
        aria-label="Location summary"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Providers connected"
          value={connectedProviders}
          icon={Plug}
          accent="#3b7af5"
        />
        <StatCard
          label="Unreplied reviews"
          value={unrepliedReviews}
          icon={Star}
          accent="#e0484e"
          delta={
            unrepliedReviews > 0
              ? { value: 'Needs a reply', tone: 'down' }
              : { value: 'All caught up', tone: 'up' }
          }
        />
        <StatCard
          label="Posts"
          value={data.posts.length}
          icon={Megaphone}
          accent="#7c3aed"
        />
        <StatCard
          label="Citations"
          value={data.citations.length}
          icon={Link2}
          accent="#1f9d55"
        />
      </section>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <span className="inline-flex items-center gap-1.5">
              <UserSquare size={14} aria-hidden="true" />
              Profile
            </span>
          </TabsTrigger>
          <TabsTrigger value="providers">
            <span className="inline-flex items-center gap-1.5">
              <Plug size={14} aria-hidden="true" />
              Providers
            </span>
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <span className="inline-flex items-center gap-1.5">
              <Star size={14} aria-hidden="true" />
              Reviews
            </span>
          </TabsTrigger>
          <TabsTrigger value="posts">
            <span className="inline-flex items-center gap-1.5">
              <Megaphone size={14} aria-hidden="true" />
              Posts
            </span>
          </TabsTrigger>
          <TabsTrigger value="citations">
            <span className="inline-flex items-center gap-1.5">
              <Link2 size={14} aria-hidden="true" />
              Citations
            </span>
          </TabsTrigger>
          <TabsTrigger value="history">
            <span className="inline-flex items-center gap-1.5">
              <History size={14} aria-hidden="true" />
              Sync history
            </span>
          </TabsTrigger>
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
          <SabpublishPostsTab locationId={location._id} initial={data.posts} />
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
