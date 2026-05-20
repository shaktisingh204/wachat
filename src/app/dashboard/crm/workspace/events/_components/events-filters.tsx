'use client';

import { ZoruButton, ZoruInput, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import {
  X } from 'lucide-react';

/**
 * Filter chip row for the events list (§1D bar).
 *
 * Filters: repeat-kind · location · organizer (free-text id) · RSVP ·
 * date range · clear-all. Keep it light: no popovers; the chips are
 * plain selects/inputs that bubble up state.
 */

import * as React from 'react';

import type { EventsRepeatFilter, EventsRsvpFilter, EventsTypeFilter } from './events-shared';

export type { EventsTypeFilter };

export interface EventsFiltersRowProps {
    repeat: EventsRepeatFilter;
    onRepeatChange: (v: EventsRepeatFilter) => void;
    eventType: EventsTypeFilter;
    onEventTypeChange: (v: EventsTypeFilter) => void;
    location: string;
    onLocationChange: (v: string) => void;
    organizer: string;
    onOrganizerChange: (v: string) => void;
    rsvp: EventsRsvpFilter;
    onRsvpChange: (v: EventsRsvpFilter) => void;
    fromIso: string;
    onFromChange: (v: string) => void;
    toIso: string;
    onToChange: (v: string) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function EventsFiltersRow({
    repeat,
    onRepeatChange,
    eventType,
    onEventTypeChange,
    location,
    onLocationChange,
    organizer,
    onOrganizerChange,
    rsvp,
    onRsvpChange,
    fromIso,
    onFromChange,
    toIso,
    onToChange,
    hasActiveFilters,
    onClear,
}: EventsFiltersRowProps): React.JSX.Element {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect
                value={eventType}
                onValueChange={(v) => onEventTypeChange(v as EventsTypeFilter)}
            >
                <ZoruSelectTrigger className="h-9 w-[150px]">
                    <ZoruSelectValue placeholder="Event type" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">Any type</ZoruSelectItem>
                    <ZoruSelectItem value="meeting">Meeting</ZoruSelectItem>
                    <ZoruSelectItem value="webinar">Webinar</ZoruSelectItem>
                    <ZoruSelectItem value="workshop">Workshop</ZoruSelectItem>
                    <ZoruSelectItem value="social">Social</ZoruSelectItem>
                    <ZoruSelectItem value="training">Training</ZoruSelectItem>
                    <ZoruSelectItem value="other">Other</ZoruSelectItem>
                </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect value={repeat} onValueChange={(v) => onRepeatChange(v as EventsRepeatFilter)}>
                <ZoruSelectTrigger className="h-9 w-[140px]">
                    <ZoruSelectValue placeholder="Repeat" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">Any repeat</ZoruSelectItem>
                    <ZoruSelectItem value="repeating">Repeating</ZoruSelectItem>
                    <ZoruSelectItem value="one-off">One-off</ZoruSelectItem>
                </ZoruSelectContent>
            </ZoruSelect>

            <ZoruInput
                value={location}
                onChange={(e) => onLocationChange(e.target.value)}
                placeholder="Location…"
                className="h-9 w-[180px]"
            />

            <ZoruInput
                value={organizer}
                onChange={(e) => onOrganizerChange(e.target.value)}
                placeholder="Organizer id…"
                className="h-9 w-[180px]"
            />

            <ZoruSelect value={rsvp} onValueChange={(v) => onRsvpChange(v as EventsRsvpFilter)}>
                <ZoruSelectTrigger className="h-9 w-[140px]">
                    <ZoruSelectValue placeholder="RSVP" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">Any RSVP</ZoruSelectItem>
                    <ZoruSelectItem value="going">Going</ZoruSelectItem>
                    <ZoruSelectItem value="maybe">Maybe</ZoruSelectItem>
                    <ZoruSelectItem value="declined">Declined</ZoruSelectItem>
                    <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
                </ZoruSelectContent>
            </ZoruSelect>

            <ZoruInput
                type="date"
                value={fromIso}
                onChange={(e) => onFromChange(e.target.value)}
                className="h-9 w-[150px]"
                aria-label="From"
            />
            <ZoruInput
                type="date"
                value={toIso}
                onChange={(e) => onToChange(e.target.value)}
                className="h-9 w-[150px]"
                aria-label="To"
            />

            {hasActiveFilters ? (
                <ZoruButton variant="ghost" size="sm" onClick={onClear}>
                    <X className="h-3.5 w-3.5" /> Clear
                </ZoruButton>
            ) : null}
        </div>
    );
}

export default EventsFiltersRow;
