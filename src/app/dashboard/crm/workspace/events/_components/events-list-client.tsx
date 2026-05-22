'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import {
  useDebouncedCallback } from 'use-debounce';
import { LayoutGrid,
  LayoutList,
  Plus,
  Trash2 } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

/**
 * Events list client (§1D.1) — KPI strip, filter chips, table or
 * calendar view, bulk delete, CSV export. Hands off to <EntityListShell>.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    getEvents,
    deleteEvent,
} from '@/app/actions/worksuite/knowledge.actions';
import type { WsEvent } from '@/lib/worksuite/knowledge-types';
import type { EventKpis } from '@/app/actions/worksuite/knowledge.actions';

import { EventsKpiStrip } from './events-kpi-strip';
import { EventsFiltersRow, type EventsTypeFilter } from './events-filters';
import { EventsTable } from './events-table';
import { EventsCalendar } from './events-calendar';
import {
    EVENTS_INITIAL_FILTERS,
    computeEventsKpis,
    filterEvents,
    fmtDateTime,
    type EventsFilterState,
} from './events-shared';

type EventsViewMode = 'table' | 'calendar';

interface EventsListClientProps {
    initialEvents: (WsEvent & { _id: string })[];
    initialKpis: EventKpis;
}

export function EventsListClient({
    initialEvents,
    initialKpis: _initialKpis,
}: EventsListClientProps): React.JSX.Element {
    const { toast } = useZoruToast();

    const [events, setEvents] = React.useState<(WsEvent & { _id: string })[]>(initialEvents);
    const [loading, startTransition] = React.useTransition();

    const [filters, setFilters] = React.useState<EventsFilterState>(EVENTS_INITIAL_FILTERS);
    const [view, setView] = React.useState<EventsViewMode>('table');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [deleteId, setDeleteId] = React.useState<string | null>(null);
    const [bulkConfirm, setBulkConfirm] = React.useState(false);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            try {
                const list = (await getEvents()) as (WsEvent & { _id: string })[];
                setEvents(list);
            } catch (err) {
                toast({
                    title: 'Could not load events',
                    description: err instanceof Error ? err.message : 'Unknown error',
                    variant: 'destructive',
                });
            }
        });
    }, [toast]);

    const handleSearch = useDebouncedCallback(
        (next: string) => setFilters((prev) => ({ ...prev, search: next })),
        200,
    );

    const updateFilter = React.useCallback(
        <K extends keyof EventsFilterState>(key: K, value: EventsFilterState[K]) => {
            setFilters((prev) => ({ ...prev, [key]: value }));
        },
        [],
    );

    const clearFilters = React.useCallback(() => setFilters(EVENTS_INITIAL_FILTERS), []);

    const hasActiveFilters = React.useMemo(() => {
        const f = filters;
        return (
            f.kpiKey !== 'all' ||
            f.repeat !== 'all' ||
            f.eventType !== 'all' ||
            f.location !== '' ||
            f.organizer !== '' ||
            f.rsvp !== 'all' ||
            f.fromIso !== '' ||
            f.toIso !== '' ||
            f.search !== ''
        );
    }, [filters]);

    const visibleEvents = React.useMemo(() => filterEvents(events, filters), [events, filters]);
    const kpiCounts = React.useMemo(() => computeEventsKpis(events), [events]);

    const toggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleAll = React.useCallback(
        (all: boolean) => {
            setSelected(all ? new Set(visibleEvents.map((e) => e._id)) : new Set());
        },
        [visibleEvents],
    );

    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteId) return;
        const res = await deleteEvent(deleteId);
        if (res.success) {
            toast({ title: 'Event deleted' });
            fetchData();
        } else {
            toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
        }
        setDeleteId(null);
    }, [deleteId, fetchData, toast]);

    const runBulkDelete = React.useCallback(async () => {
        if (selected.size === 0) return;
        let ok = 0;
        let fail = 0;
        for (const id of Array.from(selected)) {
            const r = await deleteEvent(id);
            if (r.success) ok += 1;
            else fail += 1;
        }
        toast({
            title: 'Bulk delete',
            description: `${ok} deleted${fail ? `, ${fail} failed` : ''}`,
            variant: fail > 0 ? 'destructive' : undefined,
        });
        setSelected(new Set());
        setBulkConfirm(false);
        fetchData();
    }, [selected, fetchData, toast]);

    const exportCsv = React.useCallback(() => {
        const rows = selected.size > 0 ? events.filter((e) => selected.has(e._id)) : visibleEvents;
        const header = ['ID', 'Title', 'Start', 'End', 'Location', 'Repeating', 'Description'];
        const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            header.join(','),
            ...rows.map((e) =>
                [
                    esc(e._id),
                    esc(e.event_name),
                    esc(fmtDateTime(e.start_date_time)),
                    esc(fmtDateTime(e.end_date_time)),
                    esc(e.where ?? ''),
                    esc(e.repeat ? 'yes' : 'no'),
                    esc((e.description ?? '').replace(/\n/g, ' ')),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `events-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [events, visibleEvents, selected]);

    return (
        <>
            <EntityListShell
                title="Events"
                subtitle="Team meetings, webinars, and recurring sessions."
                viewSwitcher={
                    <div className="inline-flex rounded-md border border-zoru-line p-0.5">
                        <button
                            type="button"
                            onClick={() => setView('table')}
                            aria-pressed={view === 'table'}
                            className={[
                                'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
                                view === 'table'
                                    ? 'bg-zoru-surface text-zoru-ink'
                                    : 'text-zoru-ink-muted hover:text-zoru-ink',
                            ].join(' ')}
                        >
                            <LayoutList className="h-3.5 w-3.5" /> Table
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('calendar')}
                            aria-pressed={view === 'calendar'}
                            className={[
                                'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
                                view === 'calendar'
                                    ? 'bg-zoru-surface text-zoru-ink'
                                    : 'text-zoru-ink-muted hover:text-zoru-ink',
                            ].join(' ')}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" /> Calendar
                        </button>
                    </div>
                }
                search={{
                    value: filters.search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search events…',
                }}
                primaryAction={
                    <Button asChild>
                        <Link href="/dashboard/crm/workspace/events/new">
                            <Plus className="h-4 w-4" /> New event
                        </Link>
                    </Button>
                }
                filters={
                    <EventsFiltersRow
                        repeat={filters.repeat}
                        onRepeatChange={(v) => updateFilter('repeat', v)}
                        eventType={filters.eventType as EventsTypeFilter}
                        onEventTypeChange={(v) => updateFilter('eventType', v)}
                        location={filters.location}
                        onLocationChange={(v) => updateFilter('location', v)}
                        organizer={filters.organizer}
                        onOrganizerChange={(v) => updateFilter('organizer', v)}
                        rsvp={filters.rsvp}
                        onRsvpChange={(v) => updateFilter('rsvp', v)}
                        fromIso={filters.fromIso}
                        onFromChange={(v) => updateFilter('fromIso', v)}
                        toIso={filters.toIso}
                        onToChange={(v) => updateFilter('toIso', v)}
                        hasActiveFilters={hasActiveFilters}
                        onClear={clearFilters}
                    />
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[13px] text-zoru-ink-muted">
                                {selected.size} selected
                            </span>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="ghost" size="sm" onClick={exportCsv}>
                                    Export CSV
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBulkConfirm(true)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                                    Clear
                                </Button>
                            </div>
                        </div>
                    ) : null
                }
                empty={
                    !loading && events.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <h3 className="text-base font-medium text-zoru-ink">No events yet</h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Schedule your first team meeting or recurring session.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/workspace/events/new">
                                    <Plus className="h-4 w-4" /> Create event
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
                loading={loading && events.length === 0}
            >
                <div className="flex flex-col gap-4">
                    <EventsKpiStrip
                        counts={kpiCounts}
                        active={filters.kpiKey}
                        onPick={(v) => updateFilter('kpiKey', v)}
                    />

                    {view === 'table' ? (
                        <EventsTable
                            events={visibleEvents}
                            loading={loading}
                            selectedIds={selected}
                            onToggleOne={toggleOne}
                            onToggleAll={toggleAll}
                            onDelete={(id) => setDeleteId(id)}
                        />
                    ) : (
                        <EventsCalendar events={visibleEvents} />
                    )}
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={(o) => !o && setDeleteId(null)}
                title="Delete this event?"
                description="The event will be permanently removed."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />

            <ConfirmDialog
                open={bulkConfirm}
                onOpenChange={(o) => !o && setBulkConfirm(false)}
                title={`Delete ${selected.size} event(s)?`}
                description="The selected events will be permanently removed."
                requireTyped="DELETE"
                confirmLabel="Delete"
                confirmTone="danger"
                onConfirm={() => {
                    void runBulkDelete();
                }}
            />
        </>
    );
}

export default EventsListClient;
