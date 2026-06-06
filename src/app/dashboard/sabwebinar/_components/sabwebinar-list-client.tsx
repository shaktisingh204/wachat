'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  type BadgeTone,
  type BadgeStyleKind,
  Input,
  EmptyState,
  SegmentedControl,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import { Plus, Search, Video, Calendar, Users } from 'lucide-react';
import type { Sabwebinar, SabwebinarStatus } from '@/app/actions/sabwebinar.actions';

interface Props {
  items: Sabwebinar[];
}

const STATUS_FILTERS: ReadonlyArray<{ value: SabwebinarStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'live', label: 'Live' },
  { value: 'ended', label: 'Ended' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_BADGE: Record<SabwebinarStatus, { tone: BadgeTone; kind: BadgeStyleKind }> = {
  draft: { tone: 'neutral', kind: 'outline' },
  scheduled: { tone: 'info', kind: 'soft' },
  live: { tone: 'success', kind: 'solid' },
  ended: { tone: 'neutral', kind: 'soft' },
  cancelled: { tone: 'danger', kind: 'soft' },
};

function StatusBadge({ status }: { status: SabwebinarStatus }) {
  const badge = STATUS_BADGE[status] ?? { tone: 'neutral' as BadgeTone, kind: 'outline' as BadgeStyleKind };
  return (
    <Badge tone={badge.tone} kind={badge.kind}>
      {status}
    </Badge>
  );
}

export function SabwebinarListClient({ items }: Props) {
  const router = useRouter();
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
    <div className="flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>SabWebinar</PageTitle>
          <PageDescription>
            Branded webinars with registration funnel, live broadcast, and post-event analytics.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => router.push('/dashboard/sabwebinar/new')}
          >
            New webinar
          </Button>
        </PageActions>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <Input
            placeholder="Search webinars"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            iconLeft={Search}
            aria-label="Search webinars"
          />
        </div>
        <SegmentedControl
          aria-label="Filter webinars by status"
          value={filter}
          onChange={setFilter}
          items={STATUS_FILTERS}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Video}
          title="No webinars yet"
          description="Create your first branded webinar to start collecting registrations."
          action={
            <Button
              variant="primary"
              iconLeft={Plus}
              onClick={() => router.push('/dashboard/sabwebinar/new')}
            >
              New webinar
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((w) => (
            <Link key={w._id} href={`/dashboard/sabwebinar/${w._id}`} className="block">
              <Card variant="interactive" className="hover:border-[var(--st-accent)] transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2 text-base">{w.title}</CardTitle>
                    <StatusBadge status={w.status} />
                  </div>
                  <CardDescription className="line-clamp-2">
                    {w.description ?? `/${w.slug}`}
                  </CardDescription>
                </CardHeader>
                <CardBody className="flex flex-col gap-2 text-sm">
                  {w.scheduledStart ? (
                    <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
                      <Calendar className="size-4" aria-hidden="true" />
                      <span>{new Date(w.scheduledStart).toLocaleString()}</span>
                    </div>
                  ) : null}
                  {typeof w.capacity === 'number' ? (
                    <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
                      <Users className="size-4" aria-hidden="true" />
                      <span>Capacity: {w.capacity}</span>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
