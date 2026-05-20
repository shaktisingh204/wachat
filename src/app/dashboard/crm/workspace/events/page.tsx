/**
 * Events — list page (§1D.1 bar).
 *
 * Pre-fetches events and KPIs server-side; hands off to `<EventsListClient>`
 * which owns KPI strip, 6 filters, view switcher (table / calendar),
 * bulk delete, CSV export.
 */

import {
    getEvents,
    getEventKpis,
} from '@/app/actions/worksuite/knowledge.actions';
import { EventsListClient } from './_components/events-list-client';
import type { WsEvent } from '@/lib/worksuite/knowledge-types';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
    const [events, kpis] = await Promise.all([
        getEvents(),
        getEventKpis(),
    ]);
    // hrList + serialize() converts _id from ObjectId to string at runtime;
    // the TypeScript type is a white lie — cast to align with client prop.
    const serializedEvents = events as unknown as (WsEvent & { _id: string })[];
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <EventsListClient initialEvents={serializedEvents} initialKpis={kpis} />
        </div>
    );
}
