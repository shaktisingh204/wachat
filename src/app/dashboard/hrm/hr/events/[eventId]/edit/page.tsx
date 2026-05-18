import { ZoruButton } from '@/components/zoruui';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarCog } from 'lucide-react';

/**
 * Workplace Events — edit page.
 *
 * Loads the event server-side then hands it to the same `<EventForm />`
 * that powers `/new` with `initialData` set.
 */

import Link from 'next/link';

import { CrmPageHeader } from '../../../../../crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    {
                        label: 'Workplace Events',
                        href: '/dashboard/hrm/hr/events',
                    },
                    {
                        label: event.name,
                        href: `/dashboard/hrm/hr/events/${eventId}`,
                    },
                    { label: 'Edit' },
                ]}
                title={`Edit: ${event.name}`}
                subtitle="Update timing, location, organizer or attendance settings."
                icon={CalendarCog}
                actions={
                    <ZoruButton
                        variant="ghost"
                        asChild
                        className="text-zoru-ink-muted hover:text-zoru-ink"
                    >
                        <Link href={`/dashboard/hrm/hr/events/${eventId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to event
                        </Link>
                    </ZoruButton>
                }
            />

            <EventForm initialData={event} />
        </div>
    );
}
