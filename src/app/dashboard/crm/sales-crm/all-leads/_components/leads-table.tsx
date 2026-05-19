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
    Archive,
  Building,
  ChevronDown,
  Edit,
  MoreHorizontal,
  Sparkles,
  Trash2,
  } from 'lucide-react';

/**
 * <LeadsTable> — dense table for the list view.
 *
 * Renders every meaningful column per §1D.1: name · company · email ·
 * phone · source · pipeline · stage · owner · score · created · actions.
 * Rows are click-through to the detail page; per-row dropdown supplies
 * Edit / Convert / Archive / Delete.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { CrmLead, WithId } from '@/lib/definitions';

interface LeadsTableProps {
    leads: WithId<CrmLead>[];
    loading: boolean;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
    onConvert: (id: string) => void;
    convertingId?: string | null;
}

function formatMoney(value: number | undefined, currency: string | undefined): string {
    const ccy = currency || 'INR';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: ccy,
            maximumFractionDigits: 0,
        }).format(value ?? 0);
    } catch {
        return `${ccy} ${(value ?? 0).toLocaleString('en-IN')}`;
    }
}

export function LeadsTable({
    leads,
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onArchive,
    onDelete,
    onConvert,
    convertingId,
}: LeadsTableProps) {
    const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(String(l._id)));
    const someSelected = !allSelected && leads.some((l) => selectedIds.has(String(l._id)));

    return (
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                        <ZoruTableHead className="w-[36px]">
                            <ZoruCheckbox
                                aria-label="Select all leads on this page"
                                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                onCheckedChange={(c) => onToggleAll(c === true)}
                            />
                        </ZoruTableHead>
                        <ZoruTableHead>Lead</ZoruTableHead>
                        <ZoruTableHead>Company</ZoruTableHead>
                        <ZoruTableHead>Email</ZoruTableHead>
                        <ZoruTableHead>Phone</ZoruTableHead>
                        <ZoruTableHead>Source</ZoruTableHead>
                        <ZoruTableHead>Pipeline</ZoruTableHead>
                        <ZoruTableHead>Stage</ZoruTableHead>
                        <ZoruTableHead>Owner</ZoruTableHead>
                        <ZoruTableHead className="text-right">Value</ZoruTableHead>
                        <ZoruTableHead className="text-right">Score</ZoruTableHead>
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
                    ) : leads.length === 0 ? (
                        <ZoruTableRow className="border-zoru-line">
                            <ZoruTableCell
                                colSpan={13}
                                className="h-24 text-center text-[13px] text-zoru-ink-muted"
                            >
                                No leads match the current filters.
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        leads.map((lead) => {
                            const id = String(lead._id);
                            const status = (lead.status as string) || 'New';
                            const archived = status.toLowerCase() === 'archived';
                            const isSel = selectedIds.has(id);

                            return (
                                <ZoruTableRow
                                    key={id}
                                    className={[
                                        'border-zoru-line transition-colors',
                                        archived ? 'opacity-70' : '',
                                        isSel ? 'bg-zoru-surface-2/70' : '',
                                    ].join(' ')}
                                >
                                    <ZoruTableCell>
                                        <ZoruCheckbox
                                            aria-label={`Select lead ${lead.title}`}
                                            checked={isSel}
                                            onCheckedChange={() => onToggleOne(id)}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <EntityRowLink
                                            href={`/dashboard/crm/sales-crm/all-leads/${id}`}
                                            label={
                                                <span className="flex items-center gap-2">
                                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                                                        <Sparkles className="h-3.5 w-3.5" />
                                                    </span>
                                                    <span className="block truncate text-[13px]">
                                                        {lead.title || lead.contactName || 'Untitled'}
                                                    </span>
                                                </span>
                                            }
                                            subtitle={lead.contactName || undefined}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                                        {lead.company ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Building className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                                {lead.company}
                                            </span>
                                        ) : (
                                            <span className="text-zoru-ink-muted">—</span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                        {lead.email ? (
                                            <a
                                                href={`mailto:${lead.email}`}
                                                className="hover:underline"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {lead.email}
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                        {lead.phone ? (
                                            <a
                                                href={`tel:${lead.phone}`}
                                                className="hover:underline"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {lead.phone}
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                        {lead.source ? (
                                            <ZoruBadge variant="secondary">{lead.source}</ZoruBadge>
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {lead.pipelineId ? (
                                            <EntityPickerChip
                                                entity="pipeline"
                                                id={lead.pipelineId}
                                                fallback={lead.pipelineId.slice(-6)}
                                            />
                                        ) : (
                                            <span className="text-[12px] text-zoru-ink-muted">—</span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {lead.stage ? (
                                            <StatusPill label={lead.stage} tone={statusToTone(lead.stage)} />
                                        ) : (
                                            <StatusPill label={status} tone={statusToTone(status)} />
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {lead.assignedTo ? (
                                            <EntityPickerChip
                                                entity="user"
                                                id={String(lead.assignedTo)}
                                                fallback="Unassigned"
                                            />
                                        ) : (
                                            <span className="text-[12px] text-zoru-ink-muted">Unassigned</span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-[12.5px] text-zoru-ink">
                                        {formatMoney(lead.value, lead.currency)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right text-[12.5px] text-zoru-ink-muted">
                                        {(lead as any).leadScore ?? '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell
                                        className="text-[12.5px] text-zoru-ink-muted"
                                        title={lead.createdAt ? new Date(lead.createdAt).toLocaleString() : ''}
                                    >
                                        {lead.createdAt
                                            ? formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })
                                            : '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <ZoruDropdownMenu>
                                            <ZoruDropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions for ${lead.title}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </ZoruDropdownMenuTrigger>
                                            <ZoruDropdownMenuContent align="end">
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/sales-crm/all-leads/${id}`}>
                                                        <ChevronDown className="mr-1.5 h-3.5 w-3.5 rotate-[-90deg]" />
                                                        View
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/sales-crm/all-leads/${id}/edit`}>
                                                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                                                        Edit
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem
                                                    disabled={
                                                        convertingId === id || status === 'Converted'
                                                    }
                                                    onClick={() => onConvert(id)}
                                                >
                                                    <Building className="mr-1.5 h-3.5 w-3.5" />
                                                    Convert to Account
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuSeparator />
                                                <ZoruDropdownMenuItem onClick={() => onArchive(id)}>
                                                    <Archive className="mr-1.5 h-3.5 w-3.5" />
                                                    {archived ? 'Restore' : 'Archive'}
                                                </ZoruDropdownMenuItem>
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

export default LeadsTable;
