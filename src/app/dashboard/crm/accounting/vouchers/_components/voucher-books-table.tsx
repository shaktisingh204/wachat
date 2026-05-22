'use client';

import {
  Button,
  Checkbox,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
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
        <div className="overflow-x-auto rounded-lg border border-border">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-border hover:bg-transparent">
                        <ZoruTableHead className="w-10 text-muted-foreground">
                            <ZoruCheckbox
                                checked={allSelected}
                                data-indeterminate={someSelected ? 'true' : undefined}
                                onCheckedChange={(v) => onToggleAll(Boolean(v))}
                                aria-label="Select all rows"
                            />
                        </ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Name</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Type</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Prefix</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Last #</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Reset</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Default</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Active</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Approval</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {loading ? (
                        <ZoruTableRow className="border-border">
                            <ZoruTableCell colSpan={10} className="h-24 text-center">
                                <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : rows.length === 0 ? (
                        <ZoruTableRow className="border-border">
                            <ZoruTableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                No voucher books match this filter.
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        rows.map((row) => {
                            const checked = selection.has(row._id);
                            return (
                                <ZoruTableRow
                                    key={row._id}
                                    className="border-border"
                                    data-state={checked ? 'selected' : undefined}
                                >
                                    <ZoruTableCell>
                                        <ZoruCheckbox
                                            checked={checked}
                                            onCheckedChange={() => onToggle(row._id)}
                                            aria-label={`Select ${row.name}`}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-medium">
                                        <EntityRowLink
                                            href={`/dashboard/crm/accounting/vouchers/${row._id}`}
                                            label={row.name}
                                            subtitle={row.prefix ? `Prefix ${row.prefix}` : undefined}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <StatusPill label={row.type} tone="neutral" />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-[12px] text-muted-foreground">
                                        {row.prefix || '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-[12px] text-foreground">
                                        {lastNumberDisplay(row)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="capitalize text-[12px] text-foreground">
                                        {row.resetFrequency ?? 'none'}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {row.isDefault ? (
                                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {row.isActive === false ? (
                                            <StatusPill label="Inactive" tone="neutral" />
                                        ) : (
                                            <StatusPill label="Active" tone="green" />
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {row.approvalRequired ? (
                                            <StatusPill label="Required" tone="amber" />
                                        ) : (
                                            <span className="text-[12px] text-muted-foreground">No</span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <div className="flex justify-end items-center gap-1">
                                            <ZoruButton asChild variant="ghost" size="icon">
                                                <Link href={`/dashboard/crm/accounting/vouchers/${row._id}/edit`}>
                                                    <Edit className="h-4 w-4" />
                                                </Link>
                                            </ZoruButton>
                                            <ZoruDropdownMenu>
                                                <ZoruDropdownMenuTrigger asChild>
                                                    <ZoruButton variant="ghost" size="icon" aria-label="More actions">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </ZoruButton>
                                                </ZoruDropdownMenuTrigger>
                                                <ZoruDropdownMenuContent align="end">
                                                    <ZoruDropdownMenuItem asChild>
                                                        <Link href={`/dashboard/crm/accounting/vouchers/${row._id}`}>
                                                            View entries
                                                        </Link>
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem asChild>
                                                        <Link
                                                            href={`/dashboard/crm/accounting/vouchers/new?mode=entry&bookId=${row._id}`}
                                                        >
                                                            New entry
                                                        </Link>
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem asChild>
                                                        <Link href={`/dashboard/crm/accounting/vouchers/${row._id}/activity`}>
                                                            Activity
                                                        </Link>
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem onSelect={() => onDelete(row)}>
                                                        <Trash2 className="mr-2 h-3.5 w-3.5 text-destructive" />
                                                        Delete
                                                    </ZoruDropdownMenuItem>
                                                </ZoruDropdownMenuContent>
                                            </ZoruDropdownMenu>
                                        </div>
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
