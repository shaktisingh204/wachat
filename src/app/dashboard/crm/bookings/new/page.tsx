'use client';

/**
 * Create booking — `/dashboard/crm/bookings/new`.
 *
 * Client component with Suspense boundary. Bookings have no custom-field plumbing
 * (`'booking'` isn't in `WsCustomFieldBelongsTo`), so the page just
 * renders the shared `<BookingForm>` (also used by Edit).
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { BookingForm } from '../_components/booking-form';
import { Skeleton } from '@/components/sabcrm/20ui/compat';
import type { CrmBookingDoc } from '@/lib/rust-client/crm-bookings';

function BookingFormWithParams() {
    const params = useSearchParams();
    const customerId = params.get('customerId');
    const resourceId = params.get('resourceId');
    const service = params.get('service');
    const slotStart = params.get('slotStart');
    const slotEnd = params.get('slotEnd');

    const initial: Partial<CrmBookingDoc> = {};
    
    if (customerId) initial.customerId = customerId;
    if (resourceId) initial.resourceId = resourceId;
    if (service) initial.service = service;
    if (slotStart) initial.slotStart = new Date(slotStart);
    if (slotEnd) initial.slotEnd = new Date(slotEnd);

    return <BookingForm initial={Object.keys(initial).length > 0 ? initial : undefined} />;
}

export default function NewBookingPage() {
    return (
        <EntityDetailShell
            eyebrow="BOOKING"
            title="New booking"
            back={{ href: '/dashboard/crm/bookings', label: 'Bookings' }}
        >
            <React.Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
                <BookingFormWithParams />
            </React.Suspense>
        </EntityDetailShell>
    );
}
