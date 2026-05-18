import { Plus } from 'lucide-react';

/**
 * Workplace Events — create page.
 *
 * Server wrapper around the client-only `<EventForm />`. Keeps the
 * page header server-rendered so the breadcrumb shows up in the
 * initial HTML.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EventForm } from '../_components/event-form';

export default function NewWorkplaceEventPage() {
    return (
        <EntityListShell
            title="New Event"
            subtitle="Schedule a meeting, workshop, celebration or anything in between."
        >
            <EventForm />
        </EntityListShell>
    );
}
