/**
 * Events shared helpers — formatters, status derivation, filter types.
 *
 * Pure functions, no React. Used by the events list/detail/calendar/form
 * islands. The `WsEvent` shape lives in @/lib/worksuite/knowledge-types.
 */

import type { WsEvent } from '@/lib/worksuite/knowledge-types';

export type EventStatus = 'upcoming' | 'today' | 'in-progress' | 'past';

export type EventsKpiKey = 'all' | 'upcoming' | 'this-week' | 'today' | 'past';

export type EventsRepeatFilter = 'all' | 'repeating' | 'one-off';

export type EventsRsvpFilter = 'all' | 'going' | 'maybe' | 'declined' | 'pending';

const MS_DAY = 24 * 60 * 60 * 1000;

export function toDate(v: unknown): Date | null {
    if (!v) return null;
    const d = new Date(v as string | number | Date);
    return Number.isFinite(d.getTime()) ? d : null;
}

export function fmtDateTime(v: unknown): string {
    const d = toDate(v);
    return d ? d.toLocaleString() : '—';
}

export function fmtDate(v: unknown): string {
    const d = toDate(v);
    return d ? d.toLocaleDateString() : '—';
}

export function deriveStatus(e: WsEvent): EventStatus {
    const start = toDate(e.start_date_time);
    const end = toDate(e.end_date_time);
    const now = Date.now();
    if (start && end) {
        if (now < start.getTime()) {
            return isSameDay(start, new Date(now)) ? 'today' : 'upcoming';
        }
        if (now > end.getTime()) return 'past';
        return 'in-progress';
    }
    return 'upcoming';
}

export function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

export function isThisWeek(d: Date): boolean {
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    return diff >= 0 && diff < 7 * MS_DAY;
}

export function statusTone(s: EventStatus): 'green' | 'amber' | 'red' | 'blue' | 'neutral' {
    switch (s) {
        case 'today':
            return 'amber';
        case 'in-progress':
            return 'green';
        case 'past':
            return 'neutral';
        case 'upcoming':
        default:
            return 'blue';
    }
}

export interface EventsKpiCounts {
    total: number;
    upcoming: number;
    today: number;
    thisWeek: number;
    past: number;
    repeating: number;
}

export function computeEventsKpis(events: readonly WsEvent[]): EventsKpiCounts {
    let upcoming = 0;
    let today = 0;
    let thisWeek = 0;
    let past = 0;
    let repeating = 0;
    for (const e of events) {
        const s = deriveStatus(e);
        if (s === 'upcoming') upcoming += 1;
        if (s === 'today') today += 1;
        if (s === 'past') past += 1;
        const d = toDate(e.start_date_time);
        if (d && isThisWeek(d)) thisWeek += 1;
        if (e.repeat) repeating += 1;
    }
    return { total: events.length, upcoming, today, thisWeek, past, repeating };
}

export type EventsTypeFilter =
    | 'all'
    | 'meeting'
    | 'webinar'
    | 'workshop'
    | 'social'
    | 'training'
    | 'other';

export interface EventsFilterState {
    search: string;
    kpiKey: EventsKpiKey;
    repeat: EventsRepeatFilter;
    eventType: EventsTypeFilter;
    location: string;
    organizer: string;
    rsvp: EventsRsvpFilter;
    fromIso: string;
    toIso: string;
}

export const EVENTS_INITIAL_FILTERS: EventsFilterState = {
    search: '',
    kpiKey: 'all',
    repeat: 'all',
    eventType: 'all',
    location: '',
    organizer: '',
    rsvp: 'all',
    fromIso: '',
    toIso: '',
};

export function filterEvents<T extends WsEvent>(events: T[], f: EventsFilterState): T[] {
    const q = f.search.trim().toLowerCase();
    const from = f.fromIso ? new Date(f.fromIso).getTime() : null;
    const to = f.toIso ? new Date(f.toIso).getTime() : null;
    return events.filter((e) => {
        if (q) {
            const hay = `${e.event_name ?? ''} ${e.description ?? ''} ${e.where ?? ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        if (f.repeat === 'repeating' && !e.repeat) return false;
        if (f.repeat === 'one-off' && e.repeat) return false;
        if (f.eventType !== 'all') {
            const et = (e.repeat_type ?? '').toLowerCase();
            const nameHay = (e.event_name ?? '').toLowerCase();
            const descHay = (e.description ?? '').toLowerCase();
            // Match against event_name / description heuristically since WsEvent
            // has no explicit eventType field (the Rust CrmEventDoc does).
            if (
                !nameHay.includes(f.eventType) &&
                !descHay.includes(f.eventType) &&
                et !== f.eventType
            ) {
                return false;
            }
        }
        if (f.location && !(e.where ?? '').toLowerCase().includes(f.location.toLowerCase())) {
            return false;
        }
        const start = toDate(e.start_date_time);
        if (from !== null && start && start.getTime() < from) return false;
        if (to !== null && start && start.getTime() > to) return false;
        const status = deriveStatus(e);
        switch (f.kpiKey) {
            case 'upcoming':
                if (status !== 'upcoming' && status !== 'today') return false;
                break;
            case 'today':
                if (status !== 'today') return false;
                break;
            case 'past':
                if (status !== 'past') return false;
                break;
            case 'this-week':
                if (!(start && isThisWeek(start))) return false;
                break;
            default:
                break;
        }
        return true;
    });
}
