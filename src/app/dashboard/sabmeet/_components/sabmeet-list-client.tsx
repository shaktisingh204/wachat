'use client';

import * as React from 'react';
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
  StatCard,
  EmptyState,
  SegmentedControl,
  Separator,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import {
  Calendar,
  Plus,
  Search,
  Video,
  Clock,
  Users,
  Radio,
  BarChart3,
  PlayCircle,
} from 'lucide-react';
import type { MeetRoom } from '@/app/actions/sabmeet.actions.types';

interface MeetingsListClientProps {
  upcoming: MeetRoom[];
  past: MeetRoom[];
}

export function MeetingsListClient({ upcoming, past }: MeetingsListClientProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [view, setView] = React.useState<'upcoming' | 'past'>('upcoming');

  const liveCount = React.useMemo(
    () => [...upcoming, ...past].filter((r) => r.status === 'live').length,
    [upcoming, past],
  );

  const source = view === 'upcoming' ? upcoming : past;
  const filtered = source.filter((r) =>
    [r.name, r.description, r.joinCode]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(search.toLowerCase())),
  );

  const newMeeting = () => router.push('/dashboard/meetings/new');

  return (
    <main className="space-y-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabMeet</PageEyebrow>
          <PageTitle>Meetings</PageTitle>
          <PageDescription>
            Schedule, host, and review video meetings across your workspace.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={newMeeting}>
            New meeting
          </Button>
        </PageActions>
      </PageHeader>

      <section
        aria-label="Meeting overview"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatCard
          label="Upcoming"
          value={upcoming.length}
          icon={Calendar}
          accent="#6366f1"
        />
        <StatCard
          label="Live now"
          value={liveCount}
          icon={Radio}
          accent="#16a34a"
        />
        <StatCard
          label="Past meetings"
          value={past.length}
          icon={PlayCircle}
          accent="#0ea5e9"
        />
      </section>

      <Card padding="none">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Video
              className="h-4 w-4 text-[var(--st-text-tertiary)]"
              aria-hidden="true"
            />
            <CardTitle>{view === 'upcoming' ? 'Upcoming meetings' : 'Past meetings'}</CardTitle>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SegmentedControl
              aria-label="Filter meetings by time"
              value={view}
              onChange={setView}
              items={[
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'past', label: 'Past' },
              ]}
            />
            <div className="w-full sm:w-64">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or code"
                iconLeft={Search}
                aria-label="Search meetings"
              />
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardBody>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={
                search
                  ? 'No meetings match your search'
                  : view === 'upcoming'
                    ? 'No upcoming meetings'
                    : 'No past meetings'
              }
              description={
                search
                  ? 'Try a different name or join code.'
                  : 'Schedule a meeting or start an instant call to get going.'
              }
              action={
                search ? undefined : (
                  <Button variant="primary" iconLeft={Plus} onClick={newMeeting}>
                    New meeting
                  </Button>
                )
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((room) => (
                <MeetingCard key={room._id} room={room} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </main>
  );
}

const STATUS_BADGE: Record<string, { tone: BadgeTone; kind: BadgeStyleKind; label: string }> = {
  live: { tone: 'success', kind: 'solid', label: 'Live' },
  scheduled: { tone: 'info', kind: 'soft', label: 'Scheduled' },
  ended: { tone: 'neutral', kind: 'soft', label: 'Ended' },
  canceled: { tone: 'danger', kind: 'soft', label: 'Canceled' },
};

function MeetingCard({ room }: { room: MeetRoom }) {
  const router = useRouter();
  const start = room.scheduledStart ? new Date(room.scheduledStart) : null;
  const badge =
    STATUS_BADGE[room.status] ?? {
      tone: 'neutral' as BadgeTone,
      kind: 'outline' as BadgeStyleKind,
      label: room.status,
    };
  const inviteeCount = (room.inviteeEmails ?? []).length;

  return (
    <Card variant="interactive" className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{room.name}</CardTitle>
          <Badge tone={badge.tone} kind={badge.kind} dot={room.status === 'live'}>
            {badge.label}
          </Badge>
        </div>
        {room.description ? (
          <CardDescription className="line-clamp-2">
            {room.description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardBody className="flex flex-1 flex-col gap-2.5 text-sm">
        <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
          {start ? (
            <>
              <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="tabular-nums">{start.toLocaleString()}</span>
            </>
          ) : (
            <>
              <Video className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Instant meeting</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
          <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">
            {inviteeCount} {inviteeCount === 1 ? 'invitee' : 'invitees'}
          </span>
        </div>
        <div className="text-xs text-[var(--st-text-secondary)]">
          Join code{' '}
          <code className="rounded bg-[var(--st-bg-secondary)] px-1.5 py-0.5 font-mono text-[var(--st-text)]">
            {room.joinCode}
          </code>
        </div>
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          <Button
            size="sm"
            variant="primary"
            iconLeft={Video}
            onClick={() => router.push(`/dashboard/meetings/${room._id}/lobby`)}
          >
            Join
          </Button>
          <Button
            size="sm"
            variant="outline"
            iconLeft={PlayCircle}
            onClick={() =>
              router.push(`/dashboard/meetings/${room._id}/recordings`)
            }
          >
            Recordings
          </Button>
          <Button
            size="sm"
            variant="ghost"
            iconLeft={BarChart3}
            onClick={() => router.push(`/dashboard/meetings/${room._id}/analytics`)}
          >
            Stats
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
