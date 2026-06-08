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
  Dot,
  Input,
  StatCard,
  EmptyState,
  SegmentedControl,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import {
  Plus,
  Search,
  Presentation,
  Calendar,
  Users,
  Radio,
  CheckCircle2,
} from 'lucide-react';
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

const STATUS_BADGE: Record<SabwebinarStatus, { tone: BadgeTone; kind: BadgeStyleKind; label: string; dot?: boolean }> = {
  draft: { tone: 'neutral', kind: 'outline', label: 'Draft' },
  scheduled: { tone: 'info', kind: 'soft', label: 'Scheduled' },
  live: { tone: 'success', kind: 'solid', label: 'Live', dot: true },
  ended: { tone: 'neutral', kind: 'soft', label: 'Ended' },
  cancelled: { tone: 'danger', kind: 'soft', label: 'Cancelled' },
};

function StatusBadge({ status }: { status: SabwebinarStatus }) {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  return (
    <Badge tone={badge.tone} kind={badge.kind}>
      {badge.dot ? <Dot tone="success" pulse aria-hidden="true" /> : null}
      {badge.label}
    </Badge>
  );
}

export function SabwebinarListClient({ items }: Props) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<SabwebinarStatus | 'all'>('all');

  const stats = React.useMemo(() => {
    const live = items.filter((w) => w.status === 'live').length;
    const scheduled = items.filter((w) => w.status === 'scheduled').length;
    const ended = items.filter((w) => w.status === 'ended').length;
    return { total: items.length, live, scheduled, ended };
  }, [items]);

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

  const goNew = () => router.push('/dashboard/sabwebinar/new');

  return (
    <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-4 md:p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabWebinar</PageEyebrow>
          <PageTitle>Webinars</PageTitle>
          <PageDescription>
            Branded webinars with a registration funnel, live broadcast, and post-event analytics.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={goNew}>
            New webinar
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Webinar summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="All webinars" value={stats.total} icon={Presentation} accent="#3b7af5" />
        <StatCard
          label="Live now"
          value={stats.live}
          icon={Radio}
          accent="#1f9d55"
          delta={stats.live > 0 ? { value: 'On air', tone: 'up' } : undefined}
        />
        <StatCard label="Scheduled" value={stats.scheduled} icon={Calendar} accent="#7c3aed" />
        <StatCard label="Ended" value={stats.ended} icon={CheckCircle2} />
      </section>

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
        <Card variant="outlined">
          <EmptyState
            icon={Presentation}
            title={items.length === 0 ? 'No webinars yet' : 'No webinars match your filters'}
            description={
              items.length === 0
                ? 'Create your first branded webinar to start collecting registrations.'
                : 'Try a different status filter or clear your search.'
            }
            action={
              items.length === 0 ? (
                <Button variant="primary" iconLeft={Plus} onClick={goNew}>
                  New webinar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <section aria-label="Webinars" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((w) => (
            <Link
              key={w._id}
              href={`/dashboard/sabwebinar/${w._id}`}
              className="block rounded-[var(--st-radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
            >
              <Card
                variant="interactive"
                className="h-full transition-colors hover:border-[var(--st-accent)]"
              >
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
                  <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
                    <Calendar className="size-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                    <span className="tabular-nums">
                      {w.scheduledStart
                        ? new Date(w.scheduledStart).toLocaleString()
                        : 'Not scheduled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
                    <Users className="size-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                    <span className="tabular-nums">
                      {typeof w.capacity === 'number'
                        ? `Capacity ${w.capacity.toLocaleString()}`
                        : 'Unlimited capacity'}
                    </span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
