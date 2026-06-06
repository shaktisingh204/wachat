'use client';

import { Button, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import {
  CheckCircle,
  Edit,
  LoaderCircle,
  MoreHorizontal,
  Trash2,
  XCircle } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill } from '@/components/crm/status-pill';
import type { VoucherBookRow } from './types';

interface VoucherBooksTableProps {
    rows: VoucherBookRow[];
    loading: boolean;
    selection: Set<string>;
    onToggle: (id: string) => void;
    onToggleAll: (next: boolean) => void;
    onDelete: (row: VoucherBookRow) => void;
}

function lastNumberDisplay(row: VoucherBookRow): string {
    const start = row.startingNumber ?? 0;
    const last = row.lastNumber ?? (row.entryCount ? start + (row.entryCount - 1) : start);
    const padded = row.padding && row.padding > 0 ? String(last).padStart(row.padding, '0') : String(last);
    return `${row.prefix ?? ''}${padded}${row.suffix ?? ''}`;
}

export function VoucherBooksTable({
    rows,
    loading,
    selection,
    onToggle,
    onToggleAll,
    onDelete,
}: VoucherBooksTableProps) {
    const allSelected = rows.length > 0 && rows.every((r) => selection.has(r._id));
    const someSelected = !allSelected && rows.some((r) => selection.has(r._id));

    return (
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <Table>
                <THead>
                    <Tr className="border-[var(--st-border)] hover:bg-transparent">
                        <Th className="w-10 text-[var(--st-text-secondary)]">
                            <Checkbox
                                checked={allSelected}
                                data-indeterminate={someSelected ? 'true' : undefined}
                                onCheckedChange={(v) => onToggleAll(Boolean(v))}
                                aria-label="Select all rows"
                            />
                        </Th>
                        <Th className="text-[var(--st-text-secondary)]">Name</Th>
                        <Th className="text-[var(--st-text-secondary)]">Type</Th>
                        <Th className="text-[var(--st-text-secondary)]">Prefix</Th>
                        <Th className="text-[var(--st-text-secondary)]">Last #</Th>
                        <Th className="text-[var(--st-text-secondary)]">Reset</Th>
                        <Th className="text-[var(--st-text-secondary)]">Default</Th>
                        <Th className="text-[var(--st-text-secondary)]">Active</Th>
                        <Th className="text-[var(--st-text-secondary)]">Approval</Th>
                        <Th className="text-[var(--st-text-secondary)] text-right">Actions</Th>
                    </Tr>
                </THead>
                <TBody className={loading ? 'opacity-50 pointer-events-none' : ''}>
                    {loading && rows.length === 0 ? (
                        <Tr className="border-[var(--st-border)]">
                            <Td colSpan={10} className="h-24 text-center">
                                <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                            </Td>
                        </Tr>
                    ) : rows.length === 0 ? (
                        <Tr className="border-[var(--st-border)]">
                            <Td colSpan={10} className="h-24 text-center text-[var(--st-text-secondary)]">
                                No voucher books match this filter.
                            </Td>
                        </Tr>
                    ) : (
                        rows.map((row) => {
                            const checked = selection.has(row._id);
                            return (
                                <Tr
                                    key={row._id}
                                    className="border-[var(--st-border)]"
                                    data-state={checked ? 'selected' : undefined}
                                >
                                    <Td>
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={() => onToggle(row._id)}
                                            aria-label={`Select ${row.name}`}
                                        />
                                    </Td>
                                    <Td className="font-medium">
                                        <EntityRowLink
                                            href={`/dashboard/crm/accounting/vouchers/${row._id}`}
                                            label={row.name}
                                            subtitle={row.prefix ? `Prefix ${row.prefix}` : undefined}
                                        />
                                    </Td>
                                    <Td>
                                        <StatusPill label={row.type} tone="neutral" />
                                    </Td>
                                    <Td className="font-mono text-[12px] text-[var(--st-text-secondary)]">
                                        {row.prefix || '—'}
                                    </Td>
                                    <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                        {lastNumberDisplay(row)}
                                    </Td>
                                    <Td className="capitalize text-[12px] text-[var(--st-text)]">
                                        {row.resetFrequency ?? 'none'}
                                    </Td>
                                    <Td>
                                        {row.isDefault ? (
                                            <CheckCircle className="h-4 w-4 text-[var(--st-text)]" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-[var(--st-text-secondary)]" />
                                        )}
                                    </Td>
                                    <Td>
                                        {row.isActive === false ? (
                                            <StatusPill label="Inactive" tone="neutral" />
                                        ) : (
                                            <StatusPill label="Active" tone="green" />
                                        )}
                                    </Td>
                                    <Td>
                                        {row.approvalRequired ? (
                                            <StatusPill label="Required" tone="amber" />
                                        ) : (
                                            <span className="text-[12px] text-[var(--st-text-secondary)]">No</span>
                                        )}
                                    </Td>
                                    <Td className="text-right">
                                        <div className="flex justify-end items-center gap-1">
                                            <Button asChild variant="ghost" size="icon">
                                                <Link href={`/dashboard/crm/accounting/vouchers/${row._id}/edit`}>
                                                    <Edit className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" aria-label="More actions">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/dashboard/crm/accounting/vouchers/${row._id}`}>
                                                            View entries
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                        <Link
                                                            href={`/dashboard/crm/accounting/vouchers/new?mode=entry&bookId=${row._id}`}
                                                        >
                                                            New entry
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/dashboard/crm/accounting/vouchers/${row._id}/activity`}>
                                                            Activity
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => onDelete(row)}>
                                                        <Trash2 className="mr-2 h-3.5 w-3.5 text-[var(--st-text)]" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
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
