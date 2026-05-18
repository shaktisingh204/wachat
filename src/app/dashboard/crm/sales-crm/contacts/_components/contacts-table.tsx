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
  Trash2,
  UserCircle2,
  } from 'lucide-react';

/**
 * <ContactsTable> — dense table for the contacts list view.
 *
 * Renders every meaningful column per §1D.1: name (chip) · email · phone ·
 * company · jobTitle · status · leadSource · owner · lifecycleStage ·
 * last activity · actions. Rows are click-through to the detail page;
 * per-row dropdown supplies View · Edit · Archive · Delete.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { CrmContact } from '@/lib/definitions';
import type { WithId } from 'mongodb';

interface ContactsTableProps {
    contacts: WithId<CrmContact>[];
    loading: boolean;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
}

function displayName(c: WithId<CrmContact>): string {
    const anyC = c as unknown as Record<string, unknown>;
    const first = (anyC.firstName as string | undefined) ?? '';
    const last = (anyC.lastName as string | undefined) ?? '';
    const composed = [first, last].filter(Boolean).join(' ').trim();
    if (composed) return composed;
    return c.name || c.email || 'Untitled';
}

function formatLifecycle(stage: string | undefined): string {
    if (!stage) return '';
    const map: Record<string, string> = {
        subscriber: 'Subscriber',
        lead: 'Lead',
        mql: 'MQL',
        sql: 'SQL',
        opportunity: 'Opportunity',
        customer: 'Customer',
        evangelist: 'Evangelist',
        'marketing-qualified-lead': 'MQL',
        'sales-qualified-lead': 'SQL',
    };
    return map[stage] ?? stage;
}

function formatStatus(status: string | undefined): string {
    if (!status) return 'New';
    const map: Record<string, string> = {
        new_lead: 'New lead',
        contacted: 'Contacted',
        qualified: 'Qualified',
        unqualified: 'Unqualified',
        customer: 'Customer',
        imported: 'Imported',
        archived: 'Archived',
        active: 'Active',
        inactive: 'Inactive',
    };
    return map[status] ?? status;
}

export function ContactsTable({
    contacts,
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onArchive,
    onDelete,
}: ContactsTableProps) {
    const allSelected =
        contacts.length > 0 &&
        contacts.every((c) => selectedIds.has(String(c._id)));
    const someSelected =
        !allSelected && contacts.some((c) => selectedIds.has(String(c._id)));

    return (
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                        <ZoruTableHead className="w-[36px]">
                            <ZoruCheckbox
                                aria-label="Select all contacts on this page"
                                checked={
                                    allSelected ? true : someSelected ? 'indeterminate' : false
                                }
                                onCheckedChange={(c) => onToggleAll(c === true)}
                            />
                        </ZoruTableHead>
                        <ZoruTableHead>Name</ZoruTableHead>
                        <ZoruTableHead>Email</ZoruTableHead>
                        <ZoruTableHead>Phone</ZoruTableHead>
                        <ZoruTableHead>Company</ZoruTableHead>
                        <ZoruTableHead>Job title</ZoruTableHead>
                        <ZoruTableHead>Status</ZoruTableHead>
                        <ZoruTableHead>Source</ZoruTableHead>
                        <ZoruTableHead>Owner</ZoruTableHead>
                        <ZoruTableHead>Lifecycle</ZoruTableHead>
                        <ZoruTableHead>Last activity</ZoruTableHead>
                        <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <ZoruTableRow key={i} className="border-zoru-line">
                                <ZoruTableCell colSpan={12}>
                                    <ZoruSkeleton className="h-10 w-full" />
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ))
                    ) : contacts.length === 0 ? (
                        <ZoruTableRow className="border-zoru-line">
                            <ZoruTableCell
                                colSpan={12}
                                className="h-24 text-center text-[13px] text-zoru-ink-muted"
                            >
                                No contacts match the current filters.
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        contacts.map((contact) => {
                            const id = String(contact._id);
                            const status = (contact.status as string) || 'new_lead';
                            const archived = status.toLowerCase() === 'archived';
                            const isSel = selectedIds.has(id);
                            const name = displayName(contact);
                            const lastActivity = contact.lastActivity ?? contact.updatedAt;
                            const lifecycle = formatLifecycle(contact.lifecycleStage);
                            const source =
                                contact.leadSource ?? contact.source ?? null;

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
                                            aria-label={`Select contact ${name}`}
                                            checked={isSel}
                                            onCheckedChange={() => onToggleOne(id)}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <Link
                                            href={`/dashboard/crm/sales-crm/contacts/${id}`}
                                            className="group flex items-center gap-2"
                                        >
                                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                                                <UserCircle2 className="h-3.5 w-3.5" />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-[13px] font-medium text-zoru-ink group-hover:underline">
                                                    {name}
                                                </span>
                                                {contact.accountId ? (
                                                    <span className="block truncate text-[11.5px] text-zoru-ink-muted">
                                                        Linked account
                                                    </span>
                                                ) : null}
                                            </span>
                                        </Link>
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                        {contact.email ? (
                                            <a
                                                href={`mailto:${contact.email}`}
                                                className="hover:underline"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {contact.email}
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                        {contact.phone ? (
                                            <a
                                                href={`tel:${contact.phone}`}
                                                className="hover:underline"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {contact.phone}
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                                        {contact.company ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Building className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                                {contact.company}
                                            </span>
                                        ) : contact.accountId ? (
                                            <EntityPickerChip
                                                entity="client"
                                                id={String(contact.accountId)}
                                                fallback="Account"
                                            />
                                        ) : (
                                            <span className="text-zoru-ink-muted">—</span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                        {contact.jobTitle ? (
                                            <EntityPickerChip
                                                entity="jobTitle"
                                                id={contact.jobTitle}
                                                fallback={contact.jobTitle}
                                            />
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <StatusPill
                                            label={formatStatus(status)}
                                            tone={statusToTone(status)}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {source ? (
                                            <ZoruBadge variant="secondary">
                                                {source}
                                            </ZoruBadge>
                                        ) : (
                                            <span className="text-[12px] text-zoru-ink-muted">—</span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {contact.owner ? (
                                            <EntityPickerChip
                                                entity="user"
                                                id={contact.owner}
                                                fallback="Unassigned"
                                            />
                                        ) : contact.assignedTo ? (
                                            <EntityPickerChip
                                                entity="user"
                                                id={String(contact.assignedTo)}
                                                fallback="Unassigned"
                                            />
                                        ) : (
                                            <span className="text-[12px] text-zoru-ink-muted">
                                                Unassigned
                                            </span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {lifecycle ? (
                                            <ZoruBadge variant="ghost">{lifecycle}</ZoruBadge>
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell
                                        className="text-[12.5px] text-zoru-ink-muted"
                                        title={
                                            lastActivity
                                                ? new Date(lastActivity).toLocaleString()
                                                : ''
                                        }
                                    >
                                        {lastActivity
                                            ? formatDistanceToNow(new Date(lastActivity), {
                                                  addSuffix: true,
                                              })
                                            : '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <ZoruDropdownMenu>
                                            <ZoruDropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions for ${name}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </ZoruDropdownMenuTrigger>
                                            <ZoruDropdownMenuContent align="end">
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/sales-crm/contacts/${id}`}
                                                    >
                                                        <ChevronDown className="mr-1.5 h-3.5 w-3.5 rotate-[-90deg]" />
                                                        View
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/sales-crm/contacts/${id}/edit`}
                                                    >
                                                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                                                        Edit
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/sales-crm/deals/new?contactId=${id}`}
                                                    >
                                                        <ChevronDown className="mr-1.5 h-3.5 w-3.5 rotate-180" />
                                                        Add deal
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuSeparator />
                                                <ZoruDropdownMenuItem
                                                    onClick={() => onArchive(id)}
                                                >
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

export default ContactsTable;
