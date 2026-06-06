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
} from '@/components/sabcrm/20ui/compat';
import {
  Edit,
  LoaderCircle,
  MoreHorizontal,
  Trash2 } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import type { CoaNature, CoaRow } from './types';

const NATURE_TONE: Record<CoaNature, StatusTone> = {
    Asset: 'green',
    Liability: 'red',
    Income: 'blue',
    Expense: 'amber',
    Capital: 'neutral',
};

function fmtMoney(value: number, currency = 'INR'): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return `${currency} ${value.toFixed(2)}`;
    }
}

interface CoaTableProps {
    rows: CoaRow[];
    loading: boolean;
    selection: Set<string>;
    onToggle: (id: string) => void;
    onToggleAll: (next: boolean) => void;
    onDelete: (row: CoaRow) => void;
}

export function CoaTable({ rows, loading, selection, onToggle, onToggleAll, onDelete }: CoaTableProps) {
    const allSelected = rows.length > 0 && rows.every((r) => selection.has(r._id));
    const someSelected = !allSelected && rows.some((r) => selection.has(r._id));

    return (
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <Table>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                        <ZoruTableHead className="w-10 text-zoru-ink-muted">
                            <Checkbox
                                checked={allSelected}
                                data-indeterminate={someSelected ? 'true' : undefined}
                                onCheckedChange={(v) => onToggleAll(Boolean(v))}
                                aria-label="Select all rows"
                            />
                        </ZoruTableHead>
                        <ZoruTableHead className="text-zoru-ink-muted">Code</ZoruTableHead>
                        <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                        <ZoruTableHead className="text-zoru-ink-muted">Nature</ZoruTableHead>
                        <ZoruTableHead className="text-zoru-ink-muted">Sub-nature</ZoruTableHead>
                        <ZoruTableHead className="text-zoru-ink-muted">Parent group</ZoruTableHead>
                        <ZoruTableHead className="text-zoru-ink-muted text-right">Opening</ZoruTableHead>
                        <ZoruTableHead className="text-zoru-ink-muted text-right">Balance</ZoruTableHead>
                        <ZoruTableHead className="text-zoru-ink-muted">Currency</ZoruTableHead>
                        <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {loading ? (
                        <ZoruTableRow className="border-zoru-line">
                            <ZoruTableCell colSpan={10} className="h-24 text-center">
                                <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : rows.length === 0 ? (
                        <ZoruTableRow className="border-zoru-line">
                            <ZoruTableCell colSpan={10} className="h-24 text-center text-zoru-ink-muted">
                                No accounts match this filter.
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        rows.map((row) => {
                            const checked = selection.has(row._id);
                            const nature = row.accountGroupType as CoaNature | undefined;
                            return (
                                <ZoruTableRow
                                    key={row._id}
                                    className="border-zoru-line"
                                    data-state={checked ? 'selected' : undefined}
                                >
                                    <ZoruTableCell>
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={() => onToggle(row._id)}
                                            aria-label={`Select ${row.name}`}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-[12px] text-zoru-ink-muted">
                                        {row.code || '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-medium">
                                        <EntityRowLink
                                            href={`/dashboard/crm/accounting/charts/${row._id}`}
                                            label={row.name}
                                            subtitle={row.code ? `Code ${row.code}` : undefined}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {nature ? (
                                            <StatusPill label={nature} tone={NATURE_TONE[nature]} />
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-zoru-ink capitalize">
                                        {row.accountGroupCategory?.replace(/_/g, ' ') || '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-zoru-ink">
                                        {row.accountGroupName || '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                        {fmtMoney(row.openingBalance, row.currency)} {row.balanceType}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                        {row.currentBalance != null
                                            ? `${fmtMoney(row.currentBalance, row.currency)} ${row.currentBalanceType ?? 'Dr'}`
                                            : '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-[12px] text-zoru-ink-muted">
                                        {row.currency}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <div className="flex justify-end items-center gap-1">
                                            <Button asChild variant="ghost" size="icon">
                                                <Link href={`/dashboard/crm/accounting/charts/${row._id}/edit`}>
                                                    <Edit className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                            <DropdownMenu>
                                                <ZoruDropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" aria-label="More actions">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </ZoruDropdownMenuTrigger>
                                                <ZoruDropdownMenuContent align="end">
                                                    <ZoruDropdownMenuItem asChild>
                                                        <Link href={`/dashboard/crm/accounting/charts/${row._id}`}>
                                                            View ledger
                                                        </Link>
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem asChild>
                                                        <Link href={`/dashboard/crm/accounting/charts/${row._id}/edit`}>
                                                            Edit
                                                        </Link>
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem asChild>
                                                        <Link href={`/dashboard/crm/accounting/charts/${row._id}/activity`}>
                                                            Activity
                                                        </Link>
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem onSelect={() => onDelete(row)}>
                                                        <Trash2 className="mr-2 h-3.5 w-3.5 text-zoru-ink" />
                                                        Delete
                                                    </ZoruDropdownMenuItem>
                                                </ZoruDropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            );
                        })
                    )}
                </ZoruTableBody>
            </Table>
        </div>
    );
}
