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
  EmptyState,
  SegmentedControl,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import { Calendar, Plus, Search, Video, Clock, Users } from 'lucide-react';
import type { MeetRoom } from '@/app/actions/sabmeet.actions.types';

interface MeetingsListClientProps {
  upcoming: MeetRoom[];
  past: MeetRoom[];
}

export function MeetingsListClient({ upcoming, past }: MeetingsListClientProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [view, setView] = React.useState<'upcoming' | 'past'>('upcoming');

  const source = view === 'upcoming' ? upcoming : past;
  const filtered = source.filter(r =>
    [r.name, r.description, r.joinCode]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Meetings</PageTitle>
          <PageDescription>
            Schedule, host, and review video meetings.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => router.push('/dashboard/meetings/new')}
          >
            New meeting
          </Button>
        </PageActions>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          aria-label="Filter meetings by time"
          value={view}
          onChange={setView}
          items={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
        />
        <div className="w-full max-w-sm">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search meetings..."
            iconLeft={Search}
            aria-label="Search meetings"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={view === 'upcoming' ? 'No upcoming meetings' : 'No past meetings'}
          description="Schedule a meeting or start an instant call."
          action={
            <Button
              variant="primary"
              iconLeft={Plus}
              onClick={() => router.push('/dashboard/meetings/new')}
            >
              New meeting
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(room => (
            <MeetingCard key={room._id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_BADGE: Record<string, { tone: BadgeTone; kind: BadgeStyleKind }> = {
  live: { tone: 'success', kind: 'solid' },
  ended: { tone: 'neutral', kind: 'soft' },
  canceled: { tone: 'danger', kind: 'soft' },
};

function MeetingCard({ room }: { room: MeetRoom }) {
  const router = useRouter();
  const start = room.scheduledStart ? new Date(room.scheduledStart) : null;
  const badge = STATUS_BADGE[room.status] ?? { tone: 'neutral' as BadgeTone, kind: 'outline' as BadgeStyleKind };

  return (
    <Card variant="interactive" className="hover:border-[var(--st-accent)] transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{room.name}</CardTitle>
          <Badge tone={badge.tone} kind={badge.kind}>{room.status}</Badge>
        </div>
        {room.description ? (
          <CardDescription className="line-clamp-2">{room.description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardBody className="space-y-2 text-sm">
        {start ? (
          <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>{start.toLocaleString()}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
            <Video className="h-4 w-4" aria-hidden="true" />
            <span>Instant meeting</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>{(room.inviteeEmails ?? []).length} invitee(s)</span>
        </div>
        <div className="text-xs text-[var(--st-text-secondary)]">
          Join code: <code className="font-mono">{room.joinCode}</code>
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => router.push(`/dashboard/meetings/${room._id}/lobby`)}
          >
            Join
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/dashboard/meetings/${room._id}/recordings`)}
          >
            Recordings
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/dashboard/meetings/${room._id}/analytics`)}
          >
            Stats
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
