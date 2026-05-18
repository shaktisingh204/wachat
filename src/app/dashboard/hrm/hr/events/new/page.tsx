import { ZoruButton } from '@/components/zoruui';
import { ArrowLeft, CalendarPlus } from 'lucide-react';

/**
 * Workplace Events — create page.
 *
 * Server wrapper around the client-only `<EventForm />`. Keeps the
 * page header server-rendered so the breadcrumb shows up in the
 * initial HTML.
 */

import Link from 'next/link';

import { CrmPageHeader } from '../../../../crm/_components/crm-page-header';
import { EventForm } from '../_components/event-form';

export default function NewWorkplaceEventPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    {
                        label: 'Workplace Events',
                        href: '/dashboard/hrm/hr/events',
                    },
                    { label: 'New' },
                ]}
                title="New Event"
                subtitle="Schedule a meeting, workshop, celebration or anything in between."
                icon={CalendarPlus}
                actions={
                    <ZoruButton
                        variant="ghost"
                        asChild
                        className="text-zoru-ink-muted hover:text-zoru-ink"
                    >
                        <Link href="/dashboard/hrm/hr/events">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Link>
                    </ZoruButton>
                }
            />

            <EventForm />
        </div>
    );
}
