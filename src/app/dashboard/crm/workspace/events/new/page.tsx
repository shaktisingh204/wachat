'use client';

/**
 * New event — §1D.3 bar.
 *
 * Sectioned cards via <EntityFormShell> + smart-default `?date=yyyy-mm-dd`
 * for launches from the calendar cell "+" button.
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

import { EventsForm } from '../_components/events-form';

export default function NewEventPage() {
    const params = useSearchParams();
    const date = params.get('date') ?? undefined;
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <EventsForm mode="new" initialDate={date} />
        </div>
    );
}
