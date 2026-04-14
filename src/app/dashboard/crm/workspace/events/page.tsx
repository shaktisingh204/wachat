'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calendar, Plus, MapPin, Link as LinkIcon, LoaderCircle, CalendarDays } from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  getEvents,
  deleteEvent,
} from '@/app/actions/worksuite/knowledge.actions';
import type { WsEvent } from '@/lib/worksuite/knowledge-types';

function fmt(v: unknown) {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function EventsPage() {
  const { toast } = useToast();
  const [events, setEvents] = React.useState<(WsEvent & { _id: string })[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await getEvents();
      setEvents(list as any);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (id: string) => {
    const r = await deleteEvent(id);
    if (r.success) {
      toast({ title: 'Deleted' });
      refresh();
    } else toast({ title: 'Error', description: r.error, variant: 'destructive' });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Events"
        subtitle="Team meetings, webinars, and recurring events."
        icon={Calendar}
        actions={
          <>
            <Link href="/dashboard/crm/workspace/events/calendar">
              <ClayButton variant="pill" leading={<CalendarDays className="h-4 w-4" strokeWidth={1.75} />}>
                Calendar
              </ClayButton>
            </Link>
            <Link href="/dashboard/crm/workspace/events/new">
              <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                New Event
              </ClayButton>
            </Link>
          </>
        }
      />

      {loading ? (
        <ClayCard className="flex items-center justify-center py-10">
          <LoaderCircle className="h-5 w-5 animate-spin text-clay-ink-muted" />
        </ClayCard>
      ) : events.length === 0 ? (
        <ClayCard>
          <p className="text-center text-[13px] text-clay-ink-muted">
            No events yet — click New Event to schedule one.
          </p>
        </ClayCard>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((e) => (
            <ClayCard key={e._id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/crm/workspace/events/${e._id}`}
                    className="text-[14.5px] font-semibold text-clay-ink hover:underline"
                  >
                    {e.event_name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <ClayBadge tone="blue">{fmt(e.start_date_time)}</ClayBadge>
                    <ClayBadge tone="neutral">→ {fmt(e.end_date_time)}</ClayBadge>
                    {e.repeat ? <ClayBadge tone="amber">Repeating</ClayBadge> : null}
                    {e.google_calendar ? <ClayBadge tone="rose-soft">Google</ClayBadge> : null}
                  </div>
                  {e.where ? (
                    <p className="mt-1 flex items-center gap-1 text-[12px] text-clay-ink-muted">
                      <MapPin className="h-3 w-3" /> {e.where}
                    </p>
                  ) : null}
                  {e.online_link ? (
                    <p className="mt-1 flex items-center gap-1 text-[12px] text-clay-ink-muted">
                      <LinkIcon className="h-3 w-3" />
                      <a href={e.online_link} target="_blank" rel="noreferrer" className="underline">
                        {e.online_link}
                      </a>
                    </p>
                  ) : null}
                </div>
                <ClayButton variant="ghost" size="sm" onClick={() => handleDelete(e._id)}>
                  Delete
                </ClayButton>
              </div>
            </ClayCard>
          ))}
        </div>
      )}
    </div>
  );
}
