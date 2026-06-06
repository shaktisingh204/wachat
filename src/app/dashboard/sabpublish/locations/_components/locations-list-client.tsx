'use client';

import * as React from 'react';
import Link from 'next/link';

import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  ZoruPageDescription,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/sabcrm/20ui/compat';
import type { SabpublishLocationDoc } from '@/lib/rust-client/sabpublish-locations';

export function SabpublishLocationsListClient({
  initial,
}: {
  initial: SabpublishLocationDoc[];
}) {
  return (
    <div className="zoruui space-y-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Locations</ZoruPageTitle>
          <ZoruPageDescription>
            Every physical place you publish about. One row per storefront.
          </ZoruPageDescription>
        </ZoruPageHeading>
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
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/sabpublish/locations/${loc._id}`}
                    className="font-medium hover:underline"
                  >
                    {loc.name}
                  </Link>
                  <Badge variant="outline">{loc.status ?? 'draft'}</Badge>
                </div>
                <div className="text-sm text-zoru-ink-muted">
                  {[loc.addressLine1, loc.city, loc.region]
                    .filter(Boolean)
                    .join(', ') || 'No address yet'}
                </div>
                {loc.phone ? (
                  <div className="text-sm text-zoru-ink-muted">
                    {loc.phone}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
