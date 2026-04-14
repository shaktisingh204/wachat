'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Calendar, MapPin, Link as LinkIcon, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  getEventById,
  getEventAttendees,
  rsvpEvent,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
  WsEvent,
  WsEventAttendee,
  WsEventAttendeeStatus,
} from '@/lib/worksuite/knowledge-types';

function fmt(v: unknown) {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { toast } = useToast();
  const [event, setEvent] = React.useState<(WsEvent & { _id: string }) | null>(null);
  const [attendees, setAttendees] = React.useState<WsEventAttendee[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!id) return;
    const [e, a] = await Promise.all([getEventById(id), getEventAttendees(id)]);
    setEvent(e as any);
    setAttendees(a as any);
  }, [id]);

  React.useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const handleRsvp = async (status: WsEventAttendeeStatus) => {
    if (!id) return;
    const r = await rsvpEvent(id, status);
    if (r.success) {
      toast({ title: 'RSVP', description: `Marked as ${status}.` });
      refresh();
    } else toast({ title: 'Error', description: r.error, variant: 'destructive' });
  };

  if (loading) {
    return (
      <div className="flex w-full items-center justify-center py-10">
        <LoaderCircle className="h-5 w-5 animate-spin text-clay-ink-muted" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex w-full flex-col gap-4">
        <CrmPageHeader title="Event" subtitle="Not found" icon={Calendar} />
        <ClayCard><p className="text-center text-[13px] text-clay-ink-muted">Event not found.</p></ClayCard>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={event.event_name}
        subtitle="Event details"
        icon={Calendar}
        actions={
          <Link href="/dashboard/crm/workspace/events">
            <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} />}>
              Back
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ClayBadge tone="blue">Start: {fmt(event.start_date_time)}</ClayBadge>
          <ClayBadge tone="neutral">End: {fmt(event.end_date_time)}</ClayBadge>
          {event.repeat ? <ClayBadge tone="amber">Repeats</ClayBadge> : null}
        </div>
        {event.where ? (
          <p className="flex items-center gap-1 text-[13px] text-clay-ink-muted">
            <MapPin className="h-3.5 w-3.5" /> {event.where}
          </p>
        ) : null}
        {event.online_link ? (
          <p className="flex items-center gap-1 text-[13px] text-clay-ink-muted">
            <LinkIcon className="h-3.5 w-3.5" />
            <a href={event.online_link} target="_blank" rel="noreferrer" className="underline">
              {event.online_link}
            </a>
          </p>
        ) : null}
        {event.description ? (
          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-clay-ink">
            {event.description}
          </p>
        ) : null}
      </ClayCard>

      <ClayCard>
        <h3 className="mb-3 text-[14px] font-semibold text-clay-ink">RSVP</h3>
        <div className="flex flex-wrap gap-2">
          {(['yes', 'no', 'maybe'] as WsEventAttendeeStatus[]).map((s) => (
            <ClayButton key={s} variant="pill" onClick={() => handleRsvp(s)}>
              {s === 'yes' ? 'Going' : s === 'no' ? 'Not going' : 'Maybe'}
            </ClayButton>
          ))}
        </div>
      </ClayCard>

      <ClayCard>
        <h3 className="mb-3 text-[14px] font-semibold text-clay-ink">
          Attendees ({attendees.length})
        </h3>
        {attendees.length === 0 ? (
          <p className="text-[13px] text-clay-ink-muted">No attendees yet.</p>
        ) : (
          <ul className="divide-y divide-clay-border">
            {attendees.map((a) => (
              <li key={String(a._id)} className="flex items-center justify-between py-2 text-[13px]">
                <span className="text-clay-ink">{a.user_name || a.user_id}</span>
                <ClayBadge
                  tone={
                    a.status === 'yes'
                      ? 'green'
                      : a.status === 'no'
                      ? 'red'
                      : a.status === 'maybe'
                      ? 'amber'
                      : 'neutral'
                  }
                >
                  {a.status}
                </ClayBadge>
              </li>
            ))}
          </ul>
        )}
      </ClayCard>
    </div>
  );
}
