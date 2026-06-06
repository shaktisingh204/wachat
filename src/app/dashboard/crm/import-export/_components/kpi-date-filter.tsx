'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DatePicker } from '@/components/sabcrm/20ui';

export function KpiDateFilter() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');
    
    const [start, setStart] = React.useState<Date | undefined>(startStr ? new Date(startStr) : undefined);
    const [end, setEnd] = React.useState<Date | undefined>(endStr ? new Date(endStr) : undefined);

    const handleStartChange = (d: Date | undefined) => {
        setStart(d);
        const params = new URLSearchParams(searchParams.toString());
        if (d) params.set('start', d.toISOString());
        else params.delete('start');
        router.push(`?${params.toString()}`);
    };

    const handleEndChange = (d: Date | undefined) => {
        setEnd(d);
        const params = new URLSearchParams(searchParams.toString());
        if (d) params.set('end', d.toISOString());
        else params.delete('end');
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--st-text)]">Filter KPI:</span>
            <DatePicker 
                date={start}
                onSelect={handleStartChange}
                placeholder="Start Date"
            />
            <span className="text-sm text-[var(--st-text-secondary)]">to</span>
            <DatePicker 
                date={end}
                onSelect={handleEndChange}
                placeholder="End Date"
            />
        </div>
    );
}
