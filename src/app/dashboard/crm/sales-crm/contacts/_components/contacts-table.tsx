'use client';

import { Badge, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Skeleton, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
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
import { EntityRowLink } from '@/components/crm/entity-row-link';
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
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <Table>
                <THead>
                    <Tr className="border-[var(--st-border)] hover:bg-transparent">
                        <Th className="w-[36px]">
                            <Checkbox
                                aria-label="Select all contacts on this page"
                                checked={
                                    allSelected ? true : someSelected ? 'indeterminate' : false
                                }
                                onCheckedChange={(c) => onToggleAll(c === true)}
                            />
                        </Th>
                        <Th>Name</Th>
                        <Th>Email</Th>
                        <Th>Phone</Th>
                        <Th>Company</Th>
                        <Th>Job title</Th>
                        <Th>Status</Th>
                        <Th>Source</Th>
                        <Th>Owner</Th>
                        <Th>Lifecycle</Th>
                        <Th>Last activity</Th>
                        <Th className="text-right">Actions</Th>
                    </Tr>
                </THead>
                <TBody>
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <Tr key={i} className="border-[var(--st-border)]">
                                <Td colSpan={12}>
                                    <Skeleton className="h-10 w-full" />
                                </Td>
                            </Tr>
                        ))
                    ) : contacts.length === 0 ? (
                        <Tr className="border-[var(--st-border)]">
                            <Td
                                colSpan={12}
                                className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                            >
                                No contacts match the current filters.
                            </Td>
                        </Tr>
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
                                            aria-label={`Select contact ${name}`}
                                            checked={isSel}
                                            onCheckedChange={() => onToggleOne(id)}
                                        />
                                    </Td>
                                    <Td>
                                        <EntityRowLink
                                            href={`/dashboard/crm/sales-crm/contacts/${id}`}
                                            label={
                                                <span className="flex items-center gap-2">
                                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                                                        <UserCircle2 className="h-3.5 w-3.5" />
                                                    </span>
                                                    <span className="block truncate text-[13px]">
                                                        {name}
                                                    </span>
                                                </span>
                                            }
                                            subtitle={contact.accountId ? 'Linked account' : undefined}
                                        />
                                    </Td>
                                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
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
                                    </Td>
                                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
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
                                    </Td>
                                    <Td className="text-[13px] text-[var(--st-text)]">
                                        {contact.company ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Building className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                                                {contact.company}
                                            </span>
                                        ) : contact.accountId ? (
                                            <EntityPickerChip
                                                entity="client"
                                                id={String(contact.accountId)}
                                                fallback="Account"
                                            />
                                        ) : (
                                            <span className="text-[var(--st-text-secondary)]">—</span>
                                        )}
                                    </Td>
                                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                                        {contact.jobTitle ? (
                                            <EntityPickerChip
                                                entity="jobTitle"
                                                id={contact.jobTitle}
                                                fallback={contact.jobTitle}
                                            />
                                        ) : (
                                            '—'
                                        )}
                                    </Td>
                                    <Td>
                                        <StatusPill
                                            label={formatStatus(status)}
                                            tone={statusToTone(status)}
                                        />
                                    </Td>
                                    <Td>
                                        {source ? (
                                            <Badge variant="secondary">
                                                {source}
                                            </Badge>
                                        ) : (
                                            <span className="text-[12px] text-[var(--st-text-secondary)]">—</span>
                                        )}
                                    </Td>
                                    <Td>
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
                                            <span className="text-[12px] text-[var(--st-text-secondary)]">
                                                Unassigned
                                            </span>
                                        )}
                                    </Td>
                                    <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                                        {lifecycle ? (
                                            <Badge variant="ghost">{lifecycle}</Badge>
                                        ) : (
                                            '—'
                                        )}
                                    </Td>
                                    <Td
                                        className="text-[12.5px] text-[var(--st-text-secondary)]"
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
                                    </Td>
                                    <Td className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions for ${name}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/sales-crm/contacts/${id}`}
                                                    >
                                                        <ChevronDown className="mr-1.5 h-3.5 w-3.5 rotate-[-90deg]" />
                                                        View
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/sales-crm/contacts/${id}/edit`}
                                                    >
                                                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                                                        Edit
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/sales-crm/deals/new?contactId=${id}`}
                                                    >
                                                        <ChevronDown className="mr-1.5 h-3.5 w-3.5 rotate-180" />
                                                        Add deal
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => onArchive(id)}
                                                >
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

export default ContactsTable;
