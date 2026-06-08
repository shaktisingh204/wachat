'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  StatCard,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import type { SabpublishLocationDoc } from '@/lib/rust-client/sabpublish-locations';
import type { SabpublishProviderDoc } from '@/lib/rust-client/sabpublish-providers';
import type { SabpublishSyncJobDoc } from '@/lib/rust-client/sabpublish-sync-jobs';

export interface SabpublishOverviewData {
  locations: SabpublishLocationDoc[];
  providers: SabpublishProviderDoc[];
  recentJobs: SabpublishSyncJobDoc[];
  unrepliedReviewCount: number;
}

function jobStatusTone(status: string): BadgeTone {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'success':
    case 'succeeded':
      return 'success';
    case 'failed':
    case 'error':
      return 'danger';
    case 'running':
    case 'in_progress':
    case 'pending':
    case 'queued':
      return 'info';
    default:
      return 'neutral';
  }
}

export function SabpublishOverviewClient({
  data,
}: {
  data: SabpublishOverviewData;
}) {
  const router = useRouter();

  const connectedProviders = data.providers.filter(
    (p) => p.connectionStatus === 'connected',
  ).length;
  const activeLocations = data.locations.filter(
    (l) => l.status === 'active',
  ).length;

  return (
    <div className="20ui space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>SabPublish</PageTitle>
          <PageDescription>
            One console for your business listings across Google, Yelp,
            Bing, Apple Maps and Facebook.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button
            variant="primary"
            onClick={() => router.push('/dashboard/sabpublish/locations/new')}
          >
            New location
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Locations" value={String(data.locations.length)} />
        <StatCard
          label="Active locations"
          value={String(activeLocations)}
        />
        <StatCard
          label="Providers connected"
          value={String(connectedProviders)}
        />
        <StatCard
          label="Unreplied reviews"
          value={String(data.unrepliedReviewCount)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent sync activity</CardTitle>
          <CardDescription>
            Last 10 sync jobs across all of your locations and providers.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {data.recentJobs.length === 0 ? (
            <EmptyState
              title="No sync jobs yet"
              description="Connect a provider and push your profile to see activity here."
            />
          ) : (
            <ul className="divide-y divide-[var(--st-border)]">
              {data.recentJobs.slice(0, 10).map((j) => (
                <li
                  key={j._id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div>
                    <div className="font-medium text-[var(--st-text)]">
                      {j.providerId} · {j.kind}
                    </div>
                    <div className="text-[var(--st-text-secondary)]">
                      {new Date(j.startedAt).toLocaleString()}
                    </div>
                  </div>
                  <Badge tone={jobStatusTone(j.status)}>{j.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
