import { Badge, Card } from '@/components/sabcrm/20ui';
import {
  notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

/**
 * Event detail — §1D.2 bar.
 *
 * Server entry: fetches the event + attendees, renders the page chrome
 * via <EntityDetailShell>, and hands the action group + attendees-rail
 * to client islands.
 */

import { Calendar, ExternalLink, MapPin } from 'lucide-react';

import {
    getEventById,
    getEventAttendees,
} from '@/app/actions/worksuite/knowledge.actions';

import { EventsDetailActions } from '../_components/events-detail-actions';
import {
    deriveStatus,
    fmtDateTime,
    statusTone,
} from '../_components/events-shared';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { SabbackstageEventTabs } from '../_components/sabbackstage/sabbackstage-event-tabs';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const [event, attendees] = await Promise.all([
        getEventById(id),
        getEventAttendees(id),
    ]);

    if (!event) notFound();

    const ev = event as unknown as {
        _id: string;
        event_name: string;
        description?: string;
        where?: string;
        start_date_time: string;
        end_date_time: string;
        online_link?: string;
        repeat?: boolean;
        repeat_type?: string;
        repeat_every?: number;
        repeat_cycles?: number;
        send_reminder?: boolean;
        google_calendar?: boolean;
    };

    const status = deriveStatus(ev as any);
    const tone = statusTone(status);

    return (
        <div className="p-4 md:p-6">
            <EntityDetailShell
                title={ev.event_name}
                eyebrow="EVENT"
                status={{ label: status, tone }}
                back={{ href: '/dashboard/crm/workspace/events', label: 'Back to events' }}
                actions={
                    <EventsDetailActions eventId={ev._id} onlineLink={ev.online_link} />
                }
                audit={<EntityAuditTimeline entityKind="event" entityId={ev._id} />}
                rightRail={
                    <Card>
                        <h3 className="mb-3 text-[13.5px] font-semibold text-[var(--st-text)]">
                            Attendees ({attendees.length})
                        </h3>
                        {attendees.length === 0 ? (
                            <p className="text-[12.5px] text-[var(--st-text-secondary)]">No attendees yet.</p>
                        ) : (
                            <ul className="divide-y divide-[var(--st-border)]">
                                {attendees.map((a) => (
                                    <li
                                        key={String(a._id)}
                                        className="flex items-center justify-between py-2 text-[12.5px]"
                                    >
                                        <span className="text-[var(--st-text)]">{a.user_name || a.user_id}</span>
                                        <Badge
                                            variant={
                                                a.status === 'yes'
                                                    ? 'success'
                                                    : a.status === 'no'
                                                    ? 'danger'
                                                    : a.status === 'maybe'
                                                    ? 'warning'
                                                    : 'secondary'
                                            }
                                        >
                                            {a.status}
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                }
            >
                <Card>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge variant="info">
                            <Calendar className="h-3 w-3" />
                            Start: {fmtDateTime(ev.start_date_time)}
                        </Badge>
                        <Badge variant="secondary">
                            End: {fmtDateTime(ev.end_date_time)}
                        </Badge>
                        {ev.repeat ? (
                            <Badge variant="warning">
                                Repeats every {ev.repeat_every ?? 1} {ev.repeat_type ?? 'week'}
                                {ev.repeat_cycles ? ` × ${ev.repeat_cycles}` : ''}
                            </Badge>
                        ) : (
                            <Badge variant="ghost">One-off</Badge>
                        )}
                        {ev.google_calendar ? (
                            <Badge variant="ghost">Google Calendar</Badge>
                        ) : null}
                        {ev.send_reminder ? (
                            <Badge variant="ghost">Reminder on</Badge>
                        ) : null}
                    </div>
                    {ev.where ? (
                        <p className="mb-1 flex items-center gap-1 text-[13px] text-[var(--st-text-secondary)]">
                            <MapPin className="h-3.5 w-3.5" /> {ev.where}
                        </p>
                    ) : null}
                    {ev.online_link ? (
                        <p className="flex items-center gap-1 text-[13px] text-[var(--st-text-secondary)]">
                            <ExternalLink className="h-3.5 w-3.5" />
                            <a
                                href={ev.online_link}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                            >
                                {ev.online_link}
                            </a>
                        </p>
                    ) : null}
                    {ev.description ? (
                        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--st-text)]">
                            {ev.description}
                        </p>
                    ) : null}
                </Card>

                <div className="mt-4">
                    <SabbackstageEventTabs
                        eventId={ev._id}
                        eventName={ev.event_name}
                    />
                </div>
            </EntityDetailShell>
        </div>
    );
}
