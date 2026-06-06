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
} from '@/components/sabcrm/20ui/compat';
import { Calendar, Plus, Search, Video, Clock, Users } from 'lucide-react';
import type { MeetRoom } from '@/app/actions/sabmeet.actions.types';

interface MeetingsListClientProps {
  upcoming: MeetRoom[];
  past: MeetRoom[];
}

export function MeetingsListClient({ upcoming, past }: MeetingsListClientProps) {
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
        <div>
          <ZoruPageTitle>Meetings</ZoruPageTitle>
          <ZoruPageDescription>
            Schedule, host, and review video meetings.
          </ZoruPageDescription>
        </div>
        <ZoruPageActions>
          <Button asChild>
            <Link href="/dashboard/meetings/new">
              <Plus className="h-4 w-4 mr-2" /> New meeting
            </Link>
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-md border border-zoru-line p-1 bg-zoru-surface">
          <button
            onClick={() => setView('upcoming')}
            className={`px-3 py-1.5 text-sm rounded ${view === 'upcoming' ? 'bg-zoru-bg text-zoru-ink shadow-sm' : 'text-zoru-ink-muted'}`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setView('past')}
            className={`px-3 py-1.5 text-sm rounded ${view === 'past' ? 'bg-zoru-bg text-zoru-ink shadow-sm' : 'text-zoru-ink-muted'}`}
          >
            Past
          </button>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zoru-ink-muted" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search meetings..."
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title={view === 'upcoming' ? 'No upcoming meetings' : 'No past meetings'}
          description="Schedule a meeting or start an instant call."
          action={
            <Button asChild>
              <Link href="/dashboard/meetings/new">
                <Plus className="h-4 w-4 mr-2" /> New meeting
              </Link>
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

function MeetingCard({ room }: { room: MeetRoom }) {
  const start = room.scheduledStart ? new Date(room.scheduledStart) : null;
  const statusVariant =
    room.status === 'live'
      ? 'default'
      : room.status === 'ended'
        ? 'secondary'
        : room.status === 'canceled'
          ? 'destructive'
          : 'outline';

  return (
    <Card className="hover:border-zoru-brand transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{room.name}</CardTitle>
          <Badge variant={statusVariant as never}>{room.status}</Badge>
        </div>
        {room.description ? (
          <CardDescription className="line-clamp-2">{room.description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {start ? (
          <div className="flex items-center gap-2 text-zoru-ink-muted">
            <Clock className="h-4 w-4" />
            <span>{start.toLocaleString()}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-zoru-ink-muted">
            <Video className="h-4 w-4" />
            <span>Instant meeting</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-zoru-ink-muted">
          <Users className="h-4 w-4" />
          <span>{(room.inviteeEmails ?? []).length} invitee(s)</span>
        </div>
        <div className="text-xs text-zoru-ink-muted">
          Join code: <code className="font-mono">{room.joinCode}</code>
        </div>
        <div className="flex gap-2 pt-2">
          <Button asChild size="sm">
            <Link href={`/dashboard/meetings/${room._id}/lobby`}>Join</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/meetings/${room._id}/recordings`}>Recordings</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/dashboard/meetings/${room._id}/analytics`}>Stats</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
