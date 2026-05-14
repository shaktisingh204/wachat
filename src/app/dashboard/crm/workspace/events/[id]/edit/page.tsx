/**
 * Edit event — §1D.3 bar. Server entry fetches the event then hands off
 * to the shared <EventsForm> in edit mode.
 */

import { notFound } from 'next/navigation';

import { getEventById } from '@/app/actions/worksuite/knowledge.actions';
import { EventsForm } from '../../_components/events-form';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const event = await getEventById(id);
    if (!event) notFound();
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <EventsForm mode="edit" event={event as any} />
        </div>
    );
}
