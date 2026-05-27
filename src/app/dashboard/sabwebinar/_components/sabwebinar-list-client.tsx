'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Input,
  EmptyState,
  PageHeader,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
} from '@/components/zoruui';
import { Plus, Search, Video, Calendar, Users } from 'lucide-react';
import type { Sabwebinar, SabwebinarStatus } from '@/app/actions/sabwebinar.actions';

interface Props {
  items: Sabwebinar[];
}

const STATUS_FILTERS: Array<{ key: SabwebinarStatus | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'live', label: 'Live' },
  { key: 'ended', label: 'Ended' },
  { key: 'cancelled', label: 'Cancelled' },
];

function StatusBadge({ status }: { status: SabwebinarStatus }) {
  const variant: Record<SabwebinarStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'outline',
    scheduled: 'secondary',
    live: 'default',
    ended: 'outline',
    cancelled: 'destructive',
  };
  return <Badge variant={variant[status]}>{status}</Badge>;
}

export function SabwebinarListClient({ items }: Props) {
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<SabwebinarStatus | 'all'>('all');

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((w) => {
      if (filter !== 'all' && w.status !== filter) return false;
      if (!needle) return true;
      return (
        w.title.toLowerCase().includes(needle) ||
        (w.description ?? '').toLowerCase().includes(needle) ||
        w.slug.toLowerCase().includes(needle)
      );
    });
  }, [items, filter, search]);

  return (
    <div className="zoruui flex flex-col gap-6 p-6">
      <PageHeader>
        <ZoruPageTitle>SabWebinar</ZoruPageTitle>
        <ZoruPageDescription>
          Branded webinars with registration funnel, live broadcast, and post-event analytics.
        </ZoruPageDescription>
        <ZoruPageActions>
          <Button asChild>
            <Link href="/dashboard/sabwebinar/new">
              <Plus className="size-4" /> New webinar
            </Link>
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-60" />
          <Input
            placeholder="Search webinars"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Video className="size-8" />}
          title="No webinars yet"
          description="Create your first branded webinar to start collecting registrations."
          actions={
            <Button asChild>
              <Link href="/dashboard/sabwebinar/new">
                <Plus className="size-4" /> New webinar
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((w) => (
            <Link key={w._id} href={`/dashboard/sabwebinar/${w._id}`}>
              <Card interactive>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2">{w.title}</CardTitle>
                    <StatusBadge status={w.status} />
                  </div>
                  <CardDescription className="line-clamp-2">
                    {w.description ?? `/${w.slug}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  {w.scheduledStart ? (
                    <div className="flex items-center gap-2 opacity-80">
                      <Calendar className="size-4" />
                      {new Date(w.scheduledStart).toLocaleString()}
                    </div>
                  ) : null}
                  {typeof w.capacity === 'number' ? (
                    <div className="flex items-center gap-2 opacity-80">
                      <Users className="size-4" />
                      Capacity: {w.capacity}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
