'use client';

import * as React from 'react';
import Link from 'next/link';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, PageHeader, StatCard, PageDescription, PageHeading, PageTitle } from '@/components/sabcrm/20ui/compat';
import type { SabpublishLocationDoc } from '@/lib/rust-client/sabpublish-locations';
import type { SabpublishProviderDoc } from '@/lib/rust-client/sabpublish-providers';
import type { SabpublishSyncJobDoc } from '@/lib/rust-client/sabpublish-sync-jobs';

export interface SabpublishOverviewData {
  locations: SabpublishLocationDoc[];
  providers: SabpublishProviderDoc[];
  recentJobs: SabpublishSyncJobDoc[];
  unrepliedReviewCount: number;
}

export function SabpublishOverviewClient({
  data,
}: {
  data: SabpublishOverviewData;
}) {
  const connectedProviders = data.providers.filter(
    (p) => p.connectionStatus === 'connected',
  ).length;
  const activeLocations = data.locations.filter(
    (l) => l.status === 'active',
  ).length;

  return (
    <div className="zoruui space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>SabPublish</PageTitle>
          <PageDescription>
            One console for your business listings across Google, Yelp,
            Bing, Apple Maps and Facebook.
          </PageDescription>
        </PageHeading>
        <Button asChild>
          <Link href="/dashboard/sabpublish/locations/new">New location</Link>
        </Button>
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
        <CardContent>
          {data.recentJobs.length === 0 ? (
            <EmptyState
              title="No sync jobs yet"
              description="Connect a provider and push your profile to see activity here."
            />
          ) : (
            <ul className="divide-y">
              {data.recentJobs.slice(0, 10).map((j) => (
                <li
                  key={j._id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {j.providerId} · {j.kind}
                    </div>
                    <div className="text-[var(--st-text-secondary)]">
                      {new Date(j.startedAt).toLocaleString()}
                    </div>
                  </div>
                  <span className="rounded-full bg-[var(--st-bg-muted)] px-2 py-0.5 text-xs">
                    {j.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
