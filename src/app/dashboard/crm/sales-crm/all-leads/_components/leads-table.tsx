'use client';

import { Badge, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Skeleton, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
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
import type { CrmLead, WithId } from '@/lib/definitions';
import { InlineOwnerEdit, InlineStageEdit, InlineStatusEdit } from './leads-inline-edits';
import { useLeadsContext } from './leads-context';

interface LeadsTableProps {
    loading: boolean;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
    onConvert: (id: string) => void;
    convertingId?: string | null;
    onRefresh?: () => void;
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
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onArchive,
    onDelete,
    onConvert,
    convertingId,
    onRefresh,
}: LeadsTableProps) {
    const { leads, updateLeadOptimistically } = useLeadsContext();
    const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(String(l._id)));
    const someSelected = !allSelected && leads.some((l) => selectedIds.has(String(l._id)));

    return (
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <Table>
                <THead>
                    <Tr className="border-[var(--st-border)] hover:bg-transparent">
                        <Th className="w-[36px]">
                            <Checkbox
                                aria-label="Select all leads on this page"
                                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                onCheckedChange={(c) => onToggleAll(c === true)}
                            />
                        </Th>
                        <Th>Lead</Th>
                        <Th>Company</Th>
                        <Th>Email</Th>
                        <Th>Phone</Th>
                        <Th>Source</Th>
                        <Th>Pipeline</Th>
                        <Th>Stage</Th>
                        <Th>Owner</Th>
                        <Th className="text-right">Value</Th>
                        <Th className="text-right">Score</Th>
                        <Th>Created</Th>
                        <Th className="text-right">Actions</Th>
                    </Tr>
                </THead>
                <TBody>
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <Tr key={i} className="border-[var(--st-border)]">
                                <Td colSpan={13}>
                                    <Skeleton className="h-10 w-full" />
                                </Td>
                            </Tr>
                        ))
                    ) : leads.length === 0 ? (
                        <Tr className="border-[var(--st-border)]">
                            <Td
                                colSpan={13}
                                className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                            >
                                No leads match the current filters.
                            </Td>
                        </Tr>
                    ) : (
                        leads.map((lead) => {
                            const id = String(lead._id);
                            const status = (lead.status as string) || 'New';
                            const archived = status.toLowerCase() === 'archived';
                            const isSel = selectedIds.has(id);

                            return (
                                <Tr
                                    key={id}
                                    className={[
                                        'border-[var(--st-border)] transition-colors',
                                        archived ? 'opacity-70' : '',
                                        isSel ? 'bg-[var(--st-bg-muted)]/70' : '',
                                    ].join(' ')}
                                >
                                    <Td>
                                        <Checkbox
                                            aria-label={`Select lead ${lead.title}`}
                                            checked={isSel}
                                            onCheckedChange={() => onToggleOne(id)}
                                        />
                                    </Td>
                                    <Td>
                                        <EntityRowLink
                                            href={`/dashboard/crm/sales-crm/all-leads/${id}`}
                                            label={
                                                <span className="flex items-center gap-2">
                                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                                                        <Sparkles className="h-3.5 w-3.5" />
                                                    </span>
                                                    <span className="block truncate text-[13px]">
                                                        {lead.title || lead.contactName || 'Untitled'}
                                                    </span>
                                                </span>
                                            }
                                            subtitle={lead.contactName || undefined}
                                        />
                                    </Td>
                                    <Td className="text-[13px] text-[var(--st-text)]">
                                        {lead.company ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Building className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                                                {lead.company}
                                            </span>
                                        ) : (
                                            <span className="text-[var(--st-text-secondary)]">—</span>
                                        )}
                                    </Td>
                                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
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
                                    </Td>
                                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
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
                                    </Td>
                                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                                        {lead.source ? (
                                            <Badge variant="secondary">{lead.source}</Badge>
                                        ) : (
                                            '—'
                                        )}
                                    </Td>
                                    <Td>
                                        {lead.pipelineId ? (
                                            <EntityPickerChip
                                                entity="pipeline"
                                                id={lead.pipelineId}
                                                fallback={lead.pipelineId.slice(-6)}
                                            />
                                        ) : (
                                            <span className="text-[12px] text-[var(--st-text-secondary)]">—</span>
                                        )}
                                    </Td>
                                    <Td>
                                        {lead.stage ? (
                                            <InlineStageEdit 
                                                leadId={id} 
                                                stage={lead.stage} 
                                                onSaved={() => {
                                                    updateLeadOptimistically(id, { stage: lead.stage });
                                                    onRefresh?.();
                                                }} 
                                            />
                                        ) : (
                                            <InlineStatusEdit 
                                                leadId={id} 
                                                status={status} 
                                                onSaved={() => {
                                                    updateLeadOptimistically(id, { status });
                                                    onRefresh?.();
                                                }} 
                                            />
                                        )}
                                    </Td>
                                    <Td>
                                        <InlineOwnerEdit 
                                            leadId={id} 
                                            ownerId={lead.assignedTo ? String(lead.assignedTo) : null} 
                                            onSaved={() => {
                                                updateLeadOptimistically(id, { assignedTo: lead.assignedTo });
                                                onRefresh?.();
                                            }} 
                                        />
                                    </Td>
                                    <Td className="text-right font-mono text-[12.5px] text-[var(--st-text)]">
                                        {formatMoney(lead.value, lead.currency)}
                                    </Td>
                                    <Td className="text-right text-[12.5px] text-[var(--st-text-secondary)]">
                                        {(lead as any).leadScore ?? '—'}
                                    </Td>
                                    <Td
                                        className="text-[12.5px] text-[var(--st-text-secondary)]"
                                        title={lead.createdAt ? new Date(lead.createdAt).toLocaleString() : ''}
                                    >
                                        {lead.createdAt
                                            ? formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })
                                            : '—'}
                                    </Td>
                                    <Td className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions for ${lead.title}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/sales-crm/all-leads/${id}`}>
                                                        <ChevronDown className="mr-1.5 h-3.5 w-3.5 rotate-[-90deg]" />
                                                        View
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/sales-crm/all-leads/${id}/edit`}>
                                                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                                                        Edit
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    disabled={
                                                        convertingId === id || status === 'Converted'
                                                    }
                                                    onClick={() => onConvert(id)}
                                                >
                                                    <Building className="mr-1.5 h-3.5 w-3.5" />
                                                    Convert to Account
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => onArchive(id)}>
                                                    <Archive className="mr-1.5 h-3.5 w-3.5" />
                                                    {archived ? 'Restore' : 'Archive'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => onDelete(id)}
                                                    className="text-[var(--st-danger)]"
                                                >
                                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </Td>
                                </Tr>
                            );
                        })
                    )}
                </TBody>
            </Table>
        </div>
    );
}

export default LeadsTable;
