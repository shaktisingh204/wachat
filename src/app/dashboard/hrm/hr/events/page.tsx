export const dynamic = 'force-dynamic';
import { Button } from '@/components/sabcrm/20ui';
import { Plus } from 'lucide-react';

/**
 * Workplace Events — list page.
 *
 * Server component: fetches the first page of events through the
 * rust-backed `getEvents` server action, then hands the result off to
 * the client-side filter shell. Filters live in the URL (search,
 * event_type, status) so a deep-link stays meaningful and refreshes
 * survive.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getEvents } from '@/app/actions/crm-events.actions';
import type {
    CrmEventStatus,
    CrmEventType,
} from '@/lib/rust-client/crm-events';

import { EventsListClient } from './_components/events-list-client';

interface PageProps {
    searchParams: Promise<{
        q?: string;
        event_type?: string;
        status?: string;
    }>;
}

export default async function WorkplaceEventsPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const q = sp.q?.trim() || undefined;
    const eventType =
        sp.event_type && sp.event_type !== 'all'
            ? (sp.event_type as CrmEventType)
            : undefined;
    const status =
        sp.status && sp.status !== 'all'
            ? (sp.status as CrmEventStatus)
            : undefined;

    const data = await getEvents({
        q,
        eventType,
        status,
        limit: 100,
    });

    return (
        <EntityListShell
            title="Workplace Events"
            subtitle="Meetings, workshops, celebrations and everything your team shows up for."
            primaryAction={
                <Button asChild>
                    <Link href="/dashboard/hrm/hr/events/new">
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> New Event
                    </Link>
                </Button>
            }
        >
            <EventsListClient
                initialEvents={data.items}
                initialFilters={{
                    q: q ?? '',
                    event_type: eventType ?? 'all',
                    status: status ?? 'all',
                }}
            />
        </EntityListShell>
    );
}
