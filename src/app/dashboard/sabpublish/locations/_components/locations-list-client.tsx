'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, Plus, Search } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  SearchInput,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import type { SabpublishLocationDoc } from '@/lib/rust-client/sabpublish-locations';

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

export function SabpublishLocationsListClient({
  initial,
}: {
  initial: SabpublishLocationDoc[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initial;
    return initial.filter((loc) =>
      [loc.name, loc.city, loc.region, loc.addressLine1]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [initial, query]);

  return (
    <div className="20ui space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Locations</PageTitle>
          <PageDescription>
            Every physical place you publish about. One card per storefront.
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

      {initial.length === 0 ? (
        <Card>
          <CardBody className="p-6">
            <EmptyState
              icon={MapPin}
              title="No locations yet"
              description="Add a location to start syncing its profile out to listing providers."
              action={
                <Button
                  variant="primary"
                  iconLeft={Plus}
                  onClick={() =>
                    router.push('/dashboard/sabpublish/locations/new')
                  }
                >
                  New location
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="max-w-sm">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search locations"
              aria-label="Search locations"
            />
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardBody className="p-6">
                <EmptyState
                  icon={Search}
                  size="sm"
                  title="No matches"
                  description={`Nothing matched "${query}". Try a different name or city.`}
                />
              </CardBody>
            </Card>
          ) : (
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((loc) => {
                const address =
                  [loc.addressLine1, loc.city, loc.region]
                    .filter(Boolean)
                    .join(', ') || 'No address yet';
                return (
                  <li key={loc._id}>
                    <Card variant="interactive" className="h-full">
                      <CardBody className="flex h-full flex-col gap-2 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/dashboard/sabpublish/locations/${loc._id}`}
                            className="font-medium text-[var(--st-text)] after:absolute after:inset-0 hover:underline focus-visible:outline-none"
                          >
                            {loc.name}
                          </Link>
                          <Badge tone={statusTone(loc.status)}>
                            {loc.status ?? 'draft'}
                          </Badge>
                        </div>
                        <p className="flex items-center gap-1.5 text-sm text-[var(--st-text-secondary)]">
                          <MapPin
                            size={14}
                            aria-hidden="true"
                            className="shrink-0"
                          />
                          <span className="truncate">{address}</span>
                        </p>
                        {loc.phone ? (
                          <p className="flex items-center gap-1.5 text-sm text-[var(--st-text-secondary)] tabular-nums">
                            <Phone
                              size={14}
                              aria-hidden="true"
                              className="shrink-0"
                            />
                            {loc.phone}
                          </p>
                        ) : null}
                      </CardBody>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
