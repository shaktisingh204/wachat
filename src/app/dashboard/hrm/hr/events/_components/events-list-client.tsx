'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
  useRouter } from 'next/navigation';
import { Edit,
  LoaderCircle,
  Trash2,
  Video } from 'lucide-react';

/**
 * <EventsListClient /> — the interactive layer of the Workplace
 * Events list. The server page hands us the seed list + current
 * filters; we drive the search box / filter selects, re-call
 * `getEvents` on change, and render the table.
 *
 * Per the SabFiles policy this view never exposes a free-text
 * meeting/banner URL — online events render a "Join meeting" link
 * derived from data, and the banner column is intentionally absent.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deleteEvent,
    getEvents,
} from '@/app/actions/crm-events.actions';
import type {
    CrmEventDoc,
    CrmEventStatus,
    CrmEventType,
} from '@/lib/rust-client/crm-events';

// TODO §1E: replace EVENT_TYPE_OPTIONS Select with <EnumFilterField enumName="eventType"> once eventType is added to CRM_ENUMS
const EVENT_TYPE_OPTIONS: { value: CrmEventType | 'all'; label: string }[] = [
    { value: 'all', label: 'All types' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'social', label: 'Social' },
    { value: 'holiday', label: 'Holiday' },
    { value: 'celebration', label: 'Celebration' },
    { value: 'training', label: 'Training' },
    { value: 'conference', label: 'Conference' },
    { value: 'other', label: 'Other' },
];

// TODO §1E: replace STATUS_OPTIONS Select with <EnumFilterField enumName="eventStatus"> once eventStatus is added to CRM_ENUMS
const STATUS_OPTIONS: { value: CrmEventStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<CrmEventStatus, StatusTone> = {
    draft: 'neutral',
    scheduled: 'blue',
    in_progress: 'amber',
    completed: 'green',
    cancelled: 'red',
    archived: 'neutral',
};

function fmtDateTime(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function titleCase(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface EventsListClientProps {
    initialEvents: CrmEventDoc[];
    initialFilters: {
        q: string;
        event_type: CrmEventType | 'all' | string;
        status: CrmEventStatus | 'all' | string;
    };
}

export function EventsListClient({
    initialEvents,
    initialFilters,
}: EventsListClientProps) {
    const router = useRouter();
    const { toast } = useToast();

    const [events, setEvents] = React.useState<CrmEventDoc[]>(initialEvents);
    const [search, setSearch] = React.useState<string>(initialFilters.q);
    const [eventType, setEventType] = React.useState<string>(
        initialFilters.event_type,
    );
    const [status, setStatus] = React.useState<string>(initialFilters.status);
    const [isLoading, setIsLoading] = React.useState(false);
    const [pendingDelete, setPendingDelete] = React.useState<CrmEventDoc | null>(
        null,
    );
    const [deleting, startDeleteTransition] = React.useTransition();

    // Re-fetch from the server (rust path) whenever a filter changes.
    // Debounce the search box; selects fire immediately.
    const fetchToken = React.useRef(0);

    const refetch = React.useCallback(async () => {
        const token = ++fetchToken.current;
        setIsLoading(true);
        const res = await getEvents({
            q: search.trim() || undefined,
            eventType:
                eventType && eventType !== 'all'
                    ? (eventType as CrmEventType)
                    : undefined,
            status:
                status && status !== 'all' ? (status as CrmEventStatus) : undefined,
            limit: 100,
        });
        // Drop stale results.
        if (token !== fetchToken.current) return;
        setEvents(res.items);
        setIsLoading(false);
    }, [search, eventType, status]);

    // Debounced re-fetch on search input.
    React.useEffect(() => {
        const id = setTimeout(() => {
            void refetch();
        }, 250);
        return () => clearTimeout(id);
    }, [refetch]);

    const handleDelete = () => {
        if (!pendingDelete) return;
        const target = pendingDelete;
        startDeleteTransition(async () => {
            const res = await deleteEvent(target._id);
            if (res.success) {
                toast({ title: 'Event deleted' });
                setPendingDelete(null);
                setEvents((curr) => curr.filter((e) => e._id !== target._id));
                router.refresh();
            } else {
                toast({
                    title: 'Error',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                title=""
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search events…',
                }}
                filters={
                    <>
                        <Select
                            value={eventType}
                            onValueChange={(v) => setEventType(v)}
                        >
                            <SelectTrigger className="h-9 w-[180px]">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                {EVENT_TYPE_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={status} onValueChange={(v) => setStatus(v)}>
                            <SelectTrigger className="h-9 w-[180px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </>
                }
                loading={isLoading && events.length === 0}
            >
                <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <Table>
                        <THead>
                            <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                <Th className="text-[var(--st-text-secondary)]">
                                    Name
                                </Th>
                                <Th className="text-[var(--st-text-secondary)]">
                                    Type
                                </Th>
                                <Th className="text-[var(--st-text-secondary)]">
                                    Starts at
                                </Th>
                                <Th className="text-[var(--st-text-secondary)]">
                                    Location
                                </Th>
                                <Th className="text-[var(--st-text-secondary)]">
                                    Organizer
                                </Th>
                                <Th className="text-[var(--st-text-secondary)]">
                                    Status
                                </Th>
                                <Th className="text-[var(--st-text-secondary)] text-right">
                                    Attendees
                                </Th>
                                <Th className="text-[var(--st-text-secondary)] text-right">
                                    Actions
                                </Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {isLoading && events.length === 0 ? (
                                <Tr className="border-[var(--st-border)]">
                                    <Td colSpan={8} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                    </Td>
                                </Tr>
                            ) : events.length === 0 ? (
                                <Tr className="border-[var(--st-border)]">
                                    <Td
                                        colSpan={8}
                                        className="h-24 text-center text-[var(--st-text-secondary)]"
                                    >
                                        No events match these filters.
                                    </Td>
                                </Tr>
                            ) : (
                                events.map((ev) => {
                                    const evStatus = (ev.status ?? 'draft') as CrmEventStatus;
                                    const attendees = Array.isArray(ev.attendeeIds)
                                        ? ev.attendeeIds.length
                                        : 0;
                                    return (
                                        <Tr
                                            key={ev._id}
                                            className="border-[var(--st-border)]"
                                        >
                                            <Td className="font-medium text-[var(--st-text)]">
                                                <Link
                                                    href={`/dashboard/hrm/hr/events/${ev._id}`}
                                                    className="hover:underline"
                                                >
                                                    {ev.name}
                                                </Link>
                                            </Td>
                                            <Td className="text-[var(--st-text)]">
                                                {titleCase(String(ev.eventType ?? 'other'))}
                                            </Td>
                                            <Td className="text-[var(--st-text)]">
                                                {fmtDateTime(ev.startsAt)}
                                            </Td>
                                            <Td className="text-[var(--st-text)]">
                                                <LocationCell
                                                    isOnline={Boolean(ev.isOnline)}
                                                    location={ev.location}
                                                />
                                            </Td>
                                            <Td className="text-[var(--st-text)]">
                                                {ev.organizerName || '—'}
                                            </Td>
                                            <Td>
                                                <StatusPill
                                                    label={titleCase(evStatus)}
                                                    tone={STATUS_TONE[evStatus] ?? 'neutral'}
                                                />
                                            </Td>
                                            <Td className="text-right font-mono text-[var(--st-text)]">
                                                {attendees}
                                                {typeof ev.maxAttendees === 'number'
                                                    ? ` / ${ev.maxAttendees}`
                                                    : ''}
                                            </Td>
                                            <Td className="text-right">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link
                                                        href={`/dashboard/hrm/hr/events/${ev._id}/edit`}
                                                        aria-label={`Edit ${ev.name}`}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`Delete ${ev.name}`}
                                                    onClick={() => setPendingDelete(ev)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-[var(--st-danger)]" />
                                                </Button>
                                            </Td>
                                        </Tr>
                                    );
                                })
                            )}
                        </TBody>
                    </Table>
                </div>
            </EntityListShell>

            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete event?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{pendingDelete?.name}&rdquo; will be permanently
                            removed. Attendees who RSVP&apos;d will no longer see it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting ? (
                                <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

/**
 * Display-only location cell.
 *
 * Per the SabFiles policy / project rule, the list NEVER exposes a
 * raw meeting URL paste UI. For online events we render a generic
 * "Online" chip with an icon (and, if present, the location string
 * the user provided as label) — the actual join link is gated to the
 * detail page.
 */
function LocationCell({
    isOnline,
    location,
}: {
    isOnline: boolean;
    location?: string;
}) {
    if (isOnline) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-0.5 text-xs text-[var(--st-text)]">
                <Video className="h-3 w-3" aria-hidden="true" />
                {location || 'Online'}
            </span>
        );
    }
    if (location) return <span>{location}</span>;
    return <span className="text-[var(--st-text-secondary)]">—</span>;
}

