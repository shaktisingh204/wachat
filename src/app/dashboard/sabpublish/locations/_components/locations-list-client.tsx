'use client';

import * as React from 'react';
import Link from 'next/link';

import { Badge, Button, Card, CardBody, EmptyState, PageHeader, PageDescription, PageHeading, PageTitle } from '@/components/sabcrm/20ui';
import type { SabpublishLocationDoc } from '@/lib/rust-client/sabpublish-locations';

export function SabpublishLocationsListClient({
  initial,
}: {
  initial: SabpublishLocationDoc[];
}) {
  return (
    <div className="zoruui space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Locations</PageTitle>
          <PageDescription>
            Every physical place you publish about. One row per storefront.
          </PageDescription>
        </PageHeading>
        <Button asChild>
          <Link href="/dashboard/sabpublish/locations/new">New location</Link>
        </Button>
      </PageHeader>

      {initial.length === 0 ? (
        <EmptyState
          title="No locations yet"
          description="Add a location to start syncing its profile out to listing providers."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {initial.map((loc) => (
            <Card key={loc._id}>
              <CardBody className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/sabpublish/locations/${loc._id}`}
                    className="font-medium hover:underline"
                  >
                    {loc.name}
                  </Link>
                  <Badge variant="outline">{loc.status ?? 'draft'}</Badge>
                </div>
                <div className="text-sm text-[var(--st-text-secondary)]">
                  {[loc.addressLine1, loc.city, loc.region]
                    .filter(Boolean)
                    .join(', ') || 'No address yet'}
                </div>
                {loc.phone ? (
                  <div className="text-sm text-[var(--st-text-secondary)]">
                    {loc.phone}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
