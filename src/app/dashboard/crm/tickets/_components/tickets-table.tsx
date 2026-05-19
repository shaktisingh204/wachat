'use client';

import {
  ZoruBadge,
  ZoruCheckbox,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  formatDistanceToNow } from 'date-fns';
import {
    AlertTriangle,
  ChevronDown,
  Edit,
  LifeBuoy,
  MoreHorizontal,
  Trash2,
  Combine,
  } from 'lucide-react';

/**
 * <TicketsTable> — dense table view for the Tickets list (§1D.1).
 *
 * 13 columns: select · # · Subject (chip) · Requester (polymorphic
 * chip) · Channel · Category · Priority · Severity · Status · Assignee ·
 * Due by · Created · Actions.
 *
 * `Due by` cell turns red when overdue (past + not resolved). Status
 * cell uses `StatusPill` (statusToTone). Per-row dropdown supplies the
 * standard view / edit / merge / delete actions.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { CrmTicketDoc } from '@/lib/rust-client/crm-tickets';
import type { TicketRequesterKind } from './tickets-filters';

type BadgeVariant = React.ComponentProps<typeof ZoruBadge>['variant'];

const PRIORITY_VARIANTS: Record<string, BadgeVariant> = {
    low: 'ghost',
    medium: 'success',
    high: 'warning',
    critical: 'danger',
};

interface TicketsTableProps {
    tickets: CrmTicketDoc[];
    loading: boolean;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onDelete: (id: string) => void;
    onMerge: (id: string) => void;
    /** Look up the polymorphic requester kind for a ticket. */
    requesterKindOf: (t: CrmTicketDoc) => TicketRequesterKind;
}

function isOverdue(t: CrmTicketDoc): boolean {
    const due = t.dueBy ? new Date(t.dueBy).getTime() : NaN;
    if (!Number.isFinite(due)) return false;
    const status = String(t.status ?? '').toLowerCase();
    if (status === 'resolved' || status === 'closed') return false;
    return due < Date.now();
}

function ticketNumber(t: CrmTicketDoc): string {
    const id = String(t._id);
    return `#${id.slice(-6).toUpperCase()}`;
}

export function TicketsTable({
    tickets,
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onDelete,
    onMerge,
    requesterKindOf,
}: TicketsTableProps) {
    const allSelected =
        tickets.length > 0 && tickets.every((t) => selectedIds.has(String(t._id)));
    const someSelected =
        !allSelected && tickets.some((t) => selectedIds.has(String(t._id)));

    return (
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                        <ZoruTableHead className="w-[36px]">
                            <ZoruCheckbox
                                aria-label="Select all tickets on this page"
                                checked={
                                    allSelected
                                        ? true
                                        : someSelected
                                        ? 'indeterminate'
                                        : false
                                }
                                onCheckedChange={(c) => onToggleAll(c === true)}
                            />
                        </ZoruTableHead>
                        <ZoruTableHead>#</ZoruTableHead>
                        <ZoruTableHead>Subject</ZoruTableHead>
                        <ZoruTableHead>Requester</ZoruTableHead>
                        <ZoruTableHead>Channel</ZoruTableHead>
                        <ZoruTableHead>Category</ZoruTableHead>
                        <ZoruTableHead>Priority</ZoruTableHead>
                        <ZoruTableHead>Severity</ZoruTableHead>
                        <ZoruTableHead>Status</ZoruTableHead>
                        <ZoruTableHead>Assignee</ZoruTableHead>
                        <ZoruTableHead>Due by</ZoruTableHead>
                        <ZoruTableHead>Created</ZoruTableHead>
                        <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <ZoruTableRow key={i} className="border-zoru-line">
                                <ZoruTableCell colSpan={13}>
                                    <ZoruSkeleton className="h-10 w-full" />
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ))
                    ) : tickets.length === 0 ? (
                        <ZoruTableRow className="border-zoru-line">
                            <ZoruTableCell
                                colSpan={13}
                                className="h-24 text-center text-[13px] text-zoru-ink-muted"
                            >
                                No tickets match the current filters.
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        tickets.map((t) => {
                            const id = String(t._id);
                            const isSel = selectedIds.has(id);
                            const priority = String(t.priority ?? '').toLowerCase();
                            const overdue = isOverdue(t);
                            const status = t.status ?? '';
                            const kind = requesterKindOf(t);
                            return (
                                <ZoruTableRow
                                    key={id}
                                    className={[
                                        'border-zoru-line transition-colors',
                                        isSel ? 'bg-zoru-surface-2/70' : '',
                                    ].join(' ')}
                                >
                                    <ZoruTableCell>
                                        <ZoruCheckbox
                                            aria-label={`Select ticket ${t.subject || id}`}
                                            checked={isSel}
                                            onCheckedChange={() => onToggleOne(id)}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-[12px] text-zoru-ink-muted">
                                        {ticketNumber(t)}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                                                <LifeBuoy className="h-3.5 w-3.5" />
                                            </span>
                                            <EntityRowLink
                                                href={`/dashboard/crm/tickets/${id}`}
                                                label={
                                                    <span className="block max-w-[280px] truncate text-[13px]">
                                                        {t.subject || 'Untitled'}
                                                    </span>
                                                }
                                                subtitle={t.category || undefined}
                                            />
                                        </div>
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {t.requesterId ? (
                                            <EntityPickerChip entity={kind} id={t.requesterId} />
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {t.channel ? (
                                            <ZoruBadge variant="secondary">{t.channel}</ZoruBadge>
                                        ) : (
                                            <span className="text-[12px] text-zoru-ink-muted">—</span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {t.category ? (
                                            <EntityPickerChip entity="category" id={t.category} />
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {priority ? (
                                            <ZoruBadge
                                                variant={PRIORITY_VARIANTS[priority] ?? 'ghost'}
                                            >
                                                {priority}
                                            </ZoruBadge>
                                        ) : (
                                            <span className="text-[12px] text-zoru-ink-muted">—</span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] uppercase text-zoru-ink-muted">
                                        {t.severity ?? '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {status ? (
                                            <StatusPill
                                                label={status.replace(/_/g, ' ')}
                                                tone={statusToTone(status)}
                                            />
                                        ) : (
                                            <span className="text-[12px] text-zoru-ink-muted">—</span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {t.assigneeId ? (
                                            <EntityPickerChip
                                                entity="user"
                                                id={t.assigneeId}
                                                fallback="Unassigned"
                                            />
                                        ) : (
                                            <span className="text-[12px] text-zoru-ink-muted">
                                                Unassigned
                                            </span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell
                                        className={[
                                            'text-[12.5px]',
                                            overdue
                                                ? 'font-medium text-zoru-danger-ink'
                                                : 'text-zoru-ink-muted',
                                        ].join(' ')}
                                    >
                                        {t.dueBy ? (
                                            <span className="inline-flex items-center gap-1">
                                                {overdue ? (
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                ) : null}
                                                {new Date(t.dueBy).toLocaleDateString()}
                                            </span>
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell
                                        className="text-[12.5px] text-zoru-ink-muted"
                                        title={
                                            t.createdAt
                                                ? new Date(t.createdAt).toLocaleString()
                                                : ''
                                        }
                                    >
                                        {t.createdAt
                                            ? formatDistanceToNow(new Date(t.createdAt), {
                                                  addSuffix: true,
                                              })
                                            : '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <ZoruDropdownMenu>
                                            <ZoruDropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions for ${t.subject || id}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </ZoruDropdownMenuTrigger>
                                            <ZoruDropdownMenuContent align="end">
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/tickets/${id}`}>
                                                        <ChevronDown className="mr-1.5 h-3.5 w-3.5 rotate-[-90deg]" />
                                                        View
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/tickets/${id}/edit`}>
                                                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                                                        Edit
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem onClick={() => onMerge(id)}>
                                                    <Combine className="mr-1.5 h-3.5 w-3.5" />
                                                    Merge…
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuSeparator />
                                                <ZoruDropdownMenuItem
                                                    onClick={() => onDelete(id)}
                                                    className="text-zoru-danger"
                                                >
                                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                                    Delete
                                                </ZoruDropdownMenuItem>
                                            </ZoruDropdownMenuContent>
                                        </ZoruDropdownMenu>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            );
                        })
                    )}
                </ZoruTableBody>
            </ZoruTable>
        </div>
    );
}

export default TicketsTable;
