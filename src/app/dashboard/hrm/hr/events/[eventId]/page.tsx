import { fmtDate } from '@/lib/utils';
export const dynamic = 'force-dynamic';
import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import {
  CalendarDays,
  Clock,
  Edit,
  MapPin,
  Repeat,
  User,
  Users,
  Video,
  CalendarPlus,
  } from 'lucide-react';

/**
 * Workplace Events — detail page.
 *
 * Server component, fully read-only. Pulls the event through the
 * rust-backed `getEventById`; if missing, falls through to a
 * `notFound()` so the layout's 404 boundary picks it up.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { getEventById } from '@/app/actions/crm-events.actions';
import type { CrmEventStatus } from '@/lib/rust-client/crm-events';

interface PageProps {
    params: Promise<{ eventId: string }>;
}

const STATUS_TONE: Record<CrmEventStatus, StatusTone> = {
    draft: 'neutral',
    scheduled: 'blue',
    in_progress: 'amber',
    completed: 'green',
    cancelled: 'red',
    archived: 'neutral',
};

function titleCase(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeRange(starts?: string, ends?: string, allDay?: boolean): string {
    const start = fmtDate(starts);
    if (allDay) {
        // Strip the time portion for all-day events.
        if (!starts) return '—';
        const d = new Date(starts);
        if (Number.isNaN(d.getTime())) return start;
        return fmtDate(d);
    }
    if (!ends) return start;
    return `${start} — ${fmtDate(ends)}`;
}

function Field({
    label,
    icon: Icon,
    children,
}: {
    label: string;
    icon?: React.ElementType;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
                {label}
            </div>
            <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
        </div>
    );
}

export default async function WorkplaceEventDetailPage({ params }: PageProps) {
    const { eventId } = await params;
    const event = await getEventById(eventId);
    if (!event) notFound();

    const status = (event.status ?? 'draft') as CrmEventStatus;
    const attendees = Array.isArray(event.attendeeIds)
        ? event.attendeeIds.length
        : 0;
    const rsvp =
        typeof event.rsvpCount === 'number' ? event.rsvpCount : 0;

    return (
        <EntityListShell
            title={event.name}
            subtitle={
                event.description
                    ? event.description.slice(0, 140) +
                      (event.description.length > 140 ? '…' : '')
                    : 'Workplace event'
            }
            primaryAction={
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {}}>
                        <CalendarPlus className="mr-2 h-4 w-4" />
                        Add to Calendar
                    </Button>
                    <Button asChild>
                        <Link href={`/dashboard/hrm/hr/events/${eventId}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                        </Link>
                    </Button>
                </div>
            }
        >
            {event.bannerUrl ? (
                <div className="overflow-hidden rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={event.bannerUrl}
                        alt={`${event.name} banner`}
                        className="h-56 w-full object-cover"
                    />
                </div>
            ) : null}

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center justify-between gap-3">
                        <span>Event overview</span>
                        <StatusPill
                            label={titleCase(status)}
                            tone={STATUS_TONE[status] ?? 'neutral'}
                        />
                    </ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Type" icon={CalendarDays}>
                            {titleCase(String(event.eventType ?? 'other'))}
                        </Field>
                        <Field label="Time" icon={Clock}>
                            {timeRange(event.startsAt, event.endsAt, event.isAllDay)}
                        </Field>
                        <Field
                            label={event.isOnline ? 'Online location' : 'Location'}
                            icon={event.isOnline ? Video : MapPin}
                        >
                            {event.isOnline ? (
                                <span className="inline-flex flex-col gap-1">
                                    <span>{event.location || 'Online'}</span>
                                    {event.meetingUrl ? (
                                        <a
                                            href={event.meetingUrl}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className="inline-flex w-fit items-center gap-1 text-xs text-zoru-primary hover:underline"
                                        >
                                            <Video className="h-3 w-3" /> Join meeting
                                        </a>
                                    ) : null}
                                </span>
                            ) : (
                                event.location || '—'
                            )}
                        </Field>
                        <Field label="Organizer" icon={User}>
                            {event.organizerName || '—'}
                        </Field>
                        <Field label="Attendees" icon={Users}>
                            <span className="font-mono">
                                {attendees}
                                {typeof event.maxAttendees === 'number'
                                    ? ` / ${event.maxAttendees}`
                                    : ''}
                            </span>
                        </Field>
                        <Field label="RSVPs" icon={Users}>
                            <span className="font-mono">{rsvp}</span>
                        </Field>
                        {event.isRecurring ? (
                            <Field label="Recurrence" icon={Repeat}>
                                <span className="font-mono text-[12px]">
                                    {event.recurrenceRule || 'Repeats'}
                                </span>
                            </Field>
                        ) : null}
                        {typeof event.reminderMinutes === 'number' ? (
                            <Field label="Reminder" icon={Clock}>
                                {event.reminderMinutes} min before
                            </Field>
                        ) : null}
                    </div>
                </ZoruCardContent>
            </Card>

            {event.description ? (
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Agenda / description</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-zoru-ink">
                            {event.description}
                        </p>
                    </ZoruCardContent>
                </Card>
            ) : null}
        </EntityListShell>
    );
}
