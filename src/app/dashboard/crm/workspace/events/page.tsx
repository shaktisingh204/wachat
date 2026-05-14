/**
 * Events — list page (§1D.1 bar).
 *
 * Server entry; hands off to `<EventsListClient>` which owns KPI strip,
 * 6 filters, view switcher (table / calendar), bulk delete, CSV export.
 *
 * TODO 1D.1: bulk RSVP / cancel-many — deferred until per-event bulk
 * server action exists.
 */

import { EventsListClient } from './_components/events-list-client';

export const dynamic = 'force-dynamic';

export default function EventsPage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <EventsListClient />
        </div>
    );
}
