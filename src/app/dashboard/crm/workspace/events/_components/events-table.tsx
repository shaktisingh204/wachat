'use client';

import {
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
} from '@/components/sabcrm/20ui/compat';
import {
  ExternalLink,
  MapPin,
  MoreHorizontal,
  Trash2 } from 'lucide-react';

/**
 * Events table — §1D.1 bar.
 *
 * Columns: title · start · end · location · repeating · status · actions
 * Renders status pill via statusToTone() (mapped through derived event state).
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill } from '@/components/crm/status-pill';
import { EntityRowLink } from '@/components/crm/entity-row-link';

import {
    deriveStatus,
    fmtDateTime,
    statusTone,
} from './events-shared';
import type { WsEvent } from '@/lib/worksuite/knowledge-types';

export interface EventsTableProps {
    events: (WsEvent & { _id: string })[];
    loading?: boolean;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onDelete: (id: string) => void;
}

const COL_HEADERS: { key: string; label: string }[] = [
    { key: 'select', label: '' },
    { key: 'title', label: 'Title' },
    { key: 'start', label: 'Start' },
    { key: 'end', label: 'End' },
    { key: 'location', label: 'Location' },
    { key: 'repeat', label: 'Repeat' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: '' },
];

export function EventsTable({
    events,
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onDelete,
}: EventsTableProps): React.JSX.Element {
    const allSelected = events.length > 0 && events.every((e) => selectedIds.has(e._id));
    return (
        <div className="overflow-x-auto rounded-[var(--st-radius-lg)] border border-[var(--st-border)]">
            <table className="w-full min-w-[800px] text-[13px]">
                <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                    <tr>
                        {COL_HEADERS.map((c) => (
                            <th
                                key={c.key}
                                className="px-3 py-2 text-left font-medium first:pl-3 last:pr-3"
                            >
                                {c.key === 'select' ? (
                                    <Checkbox
                                        aria-label="Select all"
                                        checked={allSelected}
                                        onCheckedChange={(v) => onToggleAll(!!v)}
                                    />
                                ) : (
                                    c.label
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--st-border)] bg-[var(--st-bg)]">
                    {events.length === 0 && !loading ? (
                        <tr>
                            <td colSpan={COL_HEADERS.length} className="p-6 text-center text-[var(--st-text-secondary)]">
                                No events match the current filters.
                            </td>
                        </tr>
                    ) : null}
                    {events.map((e) => {
                        const s = deriveStatus(e);
                        const tone = statusTone(s);
                        const checked = selectedIds.has(e._id);
                        return (
                            <tr key={e._id} className="hover:bg-[var(--st-bg-secondary)]">
                                <td className="px-3 py-2">
                                    <Checkbox
                                        aria-label={`Select ${e.event_name}`}
                                        checked={checked}
                                        onCheckedChange={() => onToggleOne(e._id)}
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <EntityRowLink
                                        href={`/dashboard/crm/workspace/events/${e._id}`}
                                        label={e.event_name}
                                    />
                                    {e.online_link ? (
                                        <a
                                            href={e.online_link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="ml-2 inline-flex items-center gap-1 text-[11.5px] text-[var(--st-text-secondary)] hover:underline"
                                        >
                                            <ExternalLink className="h-3 w-3" /> link
                                        </a>
                                    ) : null}
                                </td>
                                <td className="px-3 py-2 text-[var(--st-text-secondary)]">{fmtDateTime(e.start_date_time)}</td>
                                <td className="px-3 py-2 text-[var(--st-text-secondary)]">{fmtDateTime(e.end_date_time)}</td>
                                <td className="px-3 py-2 text-[var(--st-text-secondary)]">
                                    {e.where ? (
                                        <span className="inline-flex items-center gap-1">
                                            <MapPin className="h-3 w-3" /> {e.where}
                                        </span>
                                    ) : (
                                        '—'
                                    )}
                                </td>
                                <td className="px-3 py-2">
                                    {e.repeat ? (
                                        <Badge variant="warning">Repeating</Badge>
                                    ) : (
                                        <Badge variant="ghost">One-off</Badge>
                                    )}
                                </td>
                                <td className="px-3 py-2">
                                    <StatusPill label={s} tone={tone} />
                                </td>
                                <td className="px-3 py-2 text-right">
                                    <DropdownMenu>
                                        <ZoruDropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" aria-label="Row actions">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </ZoruDropdownMenuTrigger>
                                        <ZoruDropdownMenuContent align="end">
                                            <ZoruDropdownMenuItem asChild>
                                                <Link href={`/dashboard/crm/workspace/events/${e._id}`}>View</Link>
                                            </ZoruDropdownMenuItem>
                                            <ZoruDropdownMenuItem asChild>
                                                <Link href={`/dashboard/crm/workspace/events/${e._id}/edit`}>Edit</Link>
                                            </ZoruDropdownMenuItem>
                                            <ZoruDropdownMenuItem onClick={() => onDelete(e._id)}>
                                                <Trash2 className="h-3.5 w-3.5" /> Delete
                                            </ZoruDropdownMenuItem>
                                        </ZoruDropdownMenuContent>
                                    </DropdownMenu>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default EventsTable;
