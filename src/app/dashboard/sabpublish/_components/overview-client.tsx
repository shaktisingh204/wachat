'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  Plug,
  MessageSquareReply,
  CheckCircle2,
  History,
  Plus,
  ChevronRight,
} from 'lucide-react';

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
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
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

function locationStatusTone(status: string | undefined): BadgeTone {
  switch ((status ?? 'draft').toLowerCase()) {
    case 'active':
      return 'success';
    case 'paused':
      return 'warning';
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
            One console for your business listings across Google, Yelp, Bing,
            Apple Maps and Facebook.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => router.push('/dashboard/sabpublish/locations/new')}
          >
            New location
          </Button>
        </PageActions>
      </PageHeader>

      <section
        aria-label="Listing health"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Locations"
          value={data.locations.length}
          icon={MapPin}
          accent="#3b7af5"
          delta={
            data.locations.length
              ? { value: `${activeLocations} active`, tone: 'neutral' }
              : undefined
          }
        />
        <StatCard
          label="Active locations"
          value={activeLocations}
          icon={CheckCircle2}
          accent="#1f9d55"
        />
        <StatCard
          label="Providers connected"
          value={connectedProviders}
          icon={Plug}
          accent="#7c3aed"
        />
        <StatCard
          label="Unreplied reviews"
          value={data.unrepliedReviewCount}
          icon={MessageSquareReply}
          accent="#e0484e"
          delta={
            data.unrepliedReviewCount > 0
              ? { value: 'Needs a reply', tone: 'down' }
              : { value: 'All caught up', tone: 'up' }
          }
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <History size={16} aria-hidden="true" />
              <CardTitle>Recent sync activity</CardTitle>
            </div>
            <CardDescription>
              The last 10 sync jobs across every location and provider.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {data.recentJobs.length === 0 ? (
              <EmptyState
                icon={History}
                title="No sync jobs yet"
                description="Connect a provider and push a profile to see activity here."
                action={
                  <Button
                    variant="primary"
                    iconLeft={Plus}
                    onClick={() =>
                      router.push('/dashboard/sabpublish/locations/new')
                    }
                  >
                    Add a location
                  </Button>
                }
              />
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Provider</Th>
                    <Th>Job</Th>
                    <Th>Started</Th>
                    <Th align="right">Status</Th>
                  </Tr>
                </THead>
                <TBody>
                  {data.recentJobs.slice(0, 10).map((j) => (
                    <Tr key={j._id}>
                      <Td>
                        <span className="font-medium">{j.providerId}</span>
                      </Td>
                      <Td>{j.kind}</Td>
                      <Td className="tabular-nums text-[var(--st-text-secondary)]">
                        {new Date(j.startedAt).toLocaleString()}
                      </Td>
                      <Td align="right">
                        <Badge tone={jobStatusTone(j.status)}>{j.status}</Badge>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin size={16} aria-hidden="true" />
              <CardTitle>Locations</CardTitle>
            </div>
            <CardDescription>Jump straight to a storefront.</CardDescription>
          </CardHeader>
          <CardBody>
            {data.locations.length === 0 ? (
              <EmptyState
                icon={MapPin}
                size="sm"
                title="No locations"
                description="Add your first storefront to get started."
              />
            ) : (
              <ul className="flex flex-col gap-1">
                {data.locations.slice(0, 6).map((loc) => (
                  <li key={loc._id}>
                    <Link
                      href={`/dashboard/sabpublish/locations/${loc._id}`}
                      className="group flex items-center justify-between gap-2 rounded-[var(--st-radius-sm)] px-2 py-2 text-sm transition-colors hover:bg-[var(--st-bg-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--st-accent)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {loc.name}
                        </span>
                        <span className="block truncate text-xs text-[var(--st-text-secondary)]">
                          {[loc.city, loc.region].filter(Boolean).join(', ') ||
                            'No address yet'}
                        </span>
                      </span>
                      <Badge tone={locationStatusTone(loc.status)}>
                        {loc.status ?? 'draft'}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {data.locations.length > 0 ? (
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  iconRight={ChevronRight}
                  asChild
                >
                  <Link href="/dashboard/sabpublish/locations">
                    View all locations
                  </Link>
                </Button>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
