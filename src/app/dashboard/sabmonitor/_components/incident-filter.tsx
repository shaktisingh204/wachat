'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { SegmentedControl } from '@/components/sabcrm/20ui';

type IncidentStatus = 'all' | 'ongoing' | 'resolved';

const ITEMS: ReadonlyArray<{ value: IncidentStatus; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'resolved', label: 'Resolved' },
];

/**
 * Status filter for the incidents list. Selecting a segment updates the
 * `status` query param so the server component re-fetches the matching set.
 * Built on the 20ui SegmentedControl (roving focus, sliding accent fill).
 */
export function IncidentFilter({ status }: { status: IncidentStatus }): React.JSX.Element {
    const router = useRouter();

    const onChange = (next: IncidentStatus): void => {
        const params = new URLSearchParams();
        if (next !== 'all') params.set('status', next);
        const qs = params.toString();
        router.push(qs ? `?${qs}` : '?');
    };

    return (
        <SegmentedControl
            items={ITEMS}
            value={status}
            onChange={onChange}
            size="sm"
            aria-label="Filter incidents by status"
        />
    );
}
