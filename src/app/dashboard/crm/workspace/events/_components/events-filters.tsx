'use client';

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';
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
            <Select
                value={eventType}
                onValueChange={(v) => onEventTypeChange(v as EventsTypeFilter)}
            >
                <SelectTrigger className="h-9 w-[150px]">
                    <SelectValue placeholder="Event type" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Any type</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="webinar">Webinar</SelectItem>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                </SelectContent>
            </Select>
            <Select value={repeat} onValueChange={(v) => onRepeatChange(v as EventsRepeatFilter)}>
                <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder="Repeat" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Any repeat</SelectItem>
                    <SelectItem value="repeating">Repeating</SelectItem>
                    <SelectItem value="one-off">One-off</SelectItem>
                </SelectContent>
            </Select>

            <Input
                value={location}
                onChange={(e) => onLocationChange(e.target.value)}
                placeholder="Location…"
                className="h-9 w-[180px]"
            />

            <Input
                value={organizer}
                onChange={(e) => onOrganizerChange(e.target.value)}
                placeholder="Organizer id…"
                className="h-9 w-[180px]"
            />

            <Select value={rsvp} onValueChange={(v) => onRsvpChange(v as EventsRsvpFilter)}>
                <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder="RSVP" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Any RSVP</SelectItem>
                    <SelectItem value="going">Going</SelectItem>
                    <SelectItem value="maybe">Maybe</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
            </Select>

            <Input
                type="date"
                value={fromIso}
                onChange={(e) => onFromChange(e.target.value)}
                className="h-9 w-[150px]"
                aria-label="From"
            />
            <Input
                type="date"
                value={toIso}
                onChange={(e) => onToChange(e.target.value)}
                className="h-9 w-[150px]"
                aria-label="To"
            />

            {hasActiveFilters ? (
                <Button variant="ghost" size="sm" onClick={onClear}>
                    <X className="h-3.5 w-3.5" /> Clear
                </Button>
            ) : null}
        </div>
    );
}

export default EventsFiltersRow;
