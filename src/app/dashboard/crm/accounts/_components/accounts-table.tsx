'use client';

import {
  Checkbox,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/sabcrm/20ui/compat';
import {
  formatDistanceToNow } from 'date-fns';
import {
    Archive,
  Building,
  Edit,
  Eye,
  MoreHorizontal,
  } from 'lucide-react';

/**
 * <AccountsTable> — dense table for the accounts list view (§1D.1).
 *
 * Columns: name (chip) · industry · country · category · phone ·
 * GSTIN · currency · created · actions. Rows are click-through; per-row
 * dropdown supplies View · Edit · Archive · Delete.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill } from '@/components/crm/status-pill';
import type { CrmAccount } from '@/lib/definitions';
import type { WithId } from 'mongodb';

interface AccountsTableProps {
    accounts: WithId<CrmAccount>[];
    loading: boolean;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onArchive: (id: string) => void;
}

function categoryTone(
    category: string | undefined,
): 'green' | 'amber' | 'blue' | 'neutral' {
    switch (category) {
        case 'strategic':
            return 'green';
        case 'key':
            return 'amber';
        case 'new':
            return 'blue';
        default:
            return 'neutral';
    }
}

function statusTone(status: string | undefined): 'green' | 'neutral' {
    return status === 'archived' ? 'neutral' : 'green';
}

export function AccountsTable({
    accounts,
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onArchive,
}: AccountsTableProps) {
    const allSelected =
        accounts.length > 0 &&
        accounts.every((a) => selectedIds.has(String(a._id)));

    return (
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <Table>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                        <ZoruTableHead className="w-10">
                            <Checkbox
                                checked={allSelected}
                                onCheckedChange={(c) => onToggleAll(c === true)}
                                aria-label="Select all"
                            />
                        </ZoruTableHead>
                        <ZoruTableHead className="text-[var(--st-text-secondary)]">
                            Account
                        </ZoruTableHead>
                        <ZoruTableHead className="text-[var(--st-text-secondary)]">
                            Industry
                        </ZoruTableHead>
                        <ZoruTableHead className="text-[var(--st-text-secondary)]">
                            Country
                        </ZoruTableHead>
                        <ZoruTableHead className="text-[var(--st-text-secondary)]">
                            Category
                        </ZoruTableHead>
                        <ZoruTableHead className="text-[var(--st-text-secondary)]">
                            Phone
                        </ZoruTableHead>
                        <ZoruTableHead className="text-[var(--st-text-secondary)]">
                            GSTIN
                        </ZoruTableHead>
                        <ZoruTableHead className="text-[var(--st-text-secondary)]">
                            Currency
                        </ZoruTableHead>
                        <ZoruTableHead className="text-[var(--st-text-secondary)]">
                            Status
                        </ZoruTableHead>
                        <ZoruTableHead className="text-[var(--st-text-secondary)]">
                            Created
                        </ZoruTableHead>
                        <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">
                            Actions
                        </ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {loading
                        ? Array.from({ length: 5 }).map((_, i) => (
                              <ZoruTableRow key={i} className="border-[var(--st-border)]">
                                  <ZoruTableCell colSpan={11}>
                                      <Skeleton className="h-10 w-full" />
                                  </ZoruTableCell>
                              </ZoruTableRow>
                          ))
                        : accounts.length === 0
                          ? null
                          : accounts.map((account) => {
                                const id = String(account._id);
                                const isArchived = account.status === 'archived';
                                return (
                                    <ZoruTableRow
                                        key={id}
                                        className="border-[var(--st-border)]"
                                    >
                                        <ZoruTableCell>
                                            <Checkbox
                                                checked={selectedIds.has(id)}
                                                onCheckedChange={() =>
                                                    onToggleOne(id)
                                                }
                                                aria-label={`Select ${account.name}`}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <EntityRowLink
                                                href={`/dashboard/crm/accounts/${id}`}
                                                label={
                                                    <span className="flex items-center gap-2">
                                                        <Building
                                                            className="h-4 w-4 text-[var(--st-text-secondary)]"
                                                            strokeWidth={1.75}
                                                        />
                                                        {account.name}
                                                    </span>
                                                }
                                            />
                                            {account.website ? (
                                                <a
                                                    href={account.website}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="ml-6 block text-[11.5px] text-[var(--st-text-secondary)] hover:underline"
                                                >
                                                    {account.website}
                                                </a>
                                            ) : null}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                                            {account.industry || (
                                                <span className="text-[var(--st-text-secondary)]">
                                                    —
                                                </span>
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                                            {account.country || (
                                                <span className="text-[var(--st-text-secondary)]">
                                                    —
                                                </span>
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {account.category ? (
                                                <StatusPill
                                                    label={account.category}
                                                    tone={categoryTone(
                                                        account.category,
                                                    )}
                                                />
                                            ) : (
                                                <span className="text-[13px] text-[var(--st-text-secondary)]">
                                                    —
                                                </span>
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                                            {account.phone || (
                                                <span className="text-[var(--st-text-secondary)]">
                                                    —
                                                </span>
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[12.5px] font-mono text-[var(--st-text)]">
                                            {account.gstin || (
                                                <span className="font-sans text-[var(--st-text-secondary)]">
                                                    —
                                                </span>
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                                            {account.currency || (
                                                <span className="text-[var(--st-text-secondary)]">
                                                    —
                                                </span>
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <StatusPill
                                                label={
                                                    isArchived ? 'archived' : 'active'
                                                }
                                                tone={statusTone(account.status)}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell
                                            className="text-[12.5px] text-[var(--st-text-secondary)]"
                                            title={
                                                account.createdAt
                                                    ? new Date(
                                                          account.createdAt,
                                                      ).toLocaleString()
                                                    : ''
                                            }
                                        >
                                            {account.createdAt
                                                ? formatDistanceToNow(
                                                      new Date(account.createdAt),
                                                      { addSuffix: true },
                                                  )
                                                : '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <DropdownMenu>
                                                <ZoruDropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                                                        aria-label="Row actions"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </button>
                                                </ZoruDropdownMenuTrigger>
                                                <ZoruDropdownMenuContent align="end">
                                                    <ZoruDropdownMenuItem asChild>
                                                        <Link
                                                            href={`/dashboard/crm/accounts/${id}`}
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />{' '}
                                                            View
                                                        </Link>
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem asChild>
                                                        <Link
                                                            href={`/dashboard/crm/accounts/${id}/edit`}
                                                        >
                                                            <Edit className="h-3.5 w-3.5" />{' '}
                                                            Edit
                                                        </Link>
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuSeparator />
                                                    <ZoruDropdownMenuItem
                                                        onSelect={() =>
                                                            onArchive(id)
                                                        }
                                                    >
                                                        <Archive className="h-3.5 w-3.5" />{' '}
                                                        {isArchived
                                                            ? 'Restore'
                                                            : 'Archive'}
                                                    </ZoruDropdownMenuItem>
                                                </ZoruDropdownMenuContent>
                                            </DropdownMenu>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                );
                            })}
                </ZoruTableBody>
            </Table>
        </div>
    );
}
