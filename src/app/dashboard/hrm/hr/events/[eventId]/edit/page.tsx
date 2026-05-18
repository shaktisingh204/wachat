import { notFound } from 'next/navigation';

/**
 * Workplace Events — edit page.
 *
 * Loads the event server-side then hands it to the same `<EventForm />`
 * that powers `/new` with `initialData` set.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getEventById } from '@/app/actions/crm-events.actions';
import { EventForm } from '../../_components/event-form';

interface PageProps {
    params: Promise<{ eventId: string }>;
}

export default async function EditWorkplaceEventPage({ params }: PageProps) {
    const { eventId } = await params;
    const event = await getEventById(eventId);
    if (!event) notFound();

    return (
        <EntityListShell
            title={`Edit: ${event.name}`}
            subtitle="Update timing, location, organizer or attendance settings."
        >
            <EventForm initialData={event} />
        </EntityListShell>
    );
}
