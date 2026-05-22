'use client';

import { StatCard } from '@/components/zoruui';
import { CalendarClock, CalendarDays, CalendarRange, History, Repeat } from 'lucide-react';

/**
 * KPI strip for the events list page — 5 cards (§1D bar).
 * Each card is a button that toggles the corresponding filter slice.
 */

import * as React from 'react';

import type { EventsKpiCounts, EventsKpiKey } from './events-shared';

export interface EventsKpiStripProps {
    counts: EventsKpiCounts;
    active: EventsKpiKey;
    onPick: (key: EventsKpiKey) => void;
}

export function EventsKpiStrip({ counts, active, onPick }: EventsKpiStripProps): React.JSX.Element {
    const cards: Array<{
        key: EventsKpiKey | 'repeating';
        label: string;
        value: React.ReactNode;
        icon: React.ReactNode;
        toKey?: EventsKpiKey;
    }> = [
        { key: 'all', label: 'Total', value: counts.total, icon: <CalendarDays className="h-4 w-4" />, toKey: 'all' },
        { key: 'upcoming', label: 'Upcoming', value: counts.upcoming, icon: <CalendarClock className="h-4 w-4" />, toKey: 'upcoming' },
        { key: 'this-week', label: 'This week', value: counts.thisWeek, icon: <CalendarRange className="h-4 w-4" />, toKey: 'this-week' },
        { key: 'today', label: 'Today', value: counts.today, icon: <CalendarDays className="h-4 w-4" />, toKey: 'today' },
        { key: 'past', label: 'Past', value: counts.past, icon: <History className="h-4 w-4" />, toKey: 'past' },
        { key: 'repeating', label: 'Repeating', value: counts.repeating, icon: <Repeat className="h-4 w-4" /> },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {cards.map((c) => {
                const isActive = c.toKey !== undefined && active === c.toKey;
                const handleClick = c.toKey ? () => onPick(c.toKey as EventsKpiKey) : undefined;
                return (
                    <button
                        key={c.key}
                        type="button"
                        onClick={handleClick}
                        disabled={!handleClick}
                        className={[
                            'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary rounded-[var(--zoru-radius-lg)]',
                            isActive ? 'ring-1 ring-zoru-primary' : '',
                            handleClick ? '' : 'opacity-90 cursor-default',
                        ].join(' ')}
                    >
                        <StatCard label={c.label} value={c.value} icon={c.icon} />
                    </button>
                );
            })}
        </div>
    );
}

export default EventsKpiStrip;
