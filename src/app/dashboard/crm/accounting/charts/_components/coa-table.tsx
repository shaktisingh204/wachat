'use client';

import { Button, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
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
                        <Th className="text-[var(--st-text-secondary)]">Code</Th>
                        <Th className="text-[var(--st-text-secondary)]">Name</Th>
                        <Th className="text-[var(--st-text-secondary)]">Nature</Th>
                        <Th className="text-[var(--st-text-secondary)]">Sub-nature</Th>
                        <Th className="text-[var(--st-text-secondary)]">Parent group</Th>
                        <Th className="text-[var(--st-text-secondary)] text-right">Opening</Th>
                        <Th className="text-[var(--st-text-secondary)] text-right">Balance</Th>
                        <Th className="text-[var(--st-text-secondary)]">Currency</Th>
                        <Th className="text-[var(--st-text-secondary)] text-right">Actions</Th>
                    </Tr>
                </THead>
                <TBody>
                    {loading ? (
                        <Tr className="border-[var(--st-border)]">
                            <Td colSpan={10} className="h-24 text-center">
                                <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                            </Td>
                        </Tr>
                    ) : rows.length === 0 ? (
                        <Tr className="border-[var(--st-border)]">
                            <Td colSpan={10} className="h-24 text-center text-[var(--st-text-secondary)]">
                                No accounts match this filter.
                            </Td>
                        </Tr>
                    ) : (
                        rows.map((row) => {
                            const checked = selection.has(row._id);
                            const nature = row.accountGroupType as CoaNature | undefined;
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
                                    <Td className="font-mono text-[12px] text-[var(--st-text-secondary)]">
                                        {row.code || '—'}
                                    </Td>
                                    <Td className="font-medium">
                                        <EntityRowLink
                                            href={`/dashboard/crm/accounting/charts/${row._id}`}
                                            label={row.name}
                                            subtitle={row.code ? `Code ${row.code}` : undefined}
                                        />
                                    </Td>
                                    <Td>
                                        {nature ? (
                                            <StatusPill label={nature} tone={NATURE_TONE[nature]} />
                                        ) : (
                                            '—'
                                        )}
                                    </Td>
                                    <Td className="text-[var(--st-text)] capitalize">
                                        {row.accountGroupCategory?.replace(/_/g, ' ') || '—'}
                                    </Td>
                                    <Td className="text-[var(--st-text)]">
                                        {row.accountGroupName || '—'}
                                    </Td>
                                    <Td className="text-right font-mono text-[var(--st-text)]">
                                        {fmtMoney(row.openingBalance, row.currency)} {row.balanceType}
                                    </Td>
                                    <Td className="text-right font-mono text-[var(--st-text)]">
                                        {row.currentBalance != null
                                            ? `${fmtMoney(row.currentBalance, row.currency)} ${row.currentBalanceType ?? 'Dr'}`
                                            : '—'}
                                    </Td>
                                    <Td className="font-mono text-[12px] text-[var(--st-text-secondary)]">
                                        {row.currency}
                                    </Td>
                                    <Td className="text-right">
                                        <div className="flex justify-end items-center gap-1">
                                            <Button asChild variant="ghost" size="icon">
                                                <Link href={`/dashboard/crm/accounting/charts/${row._id}/edit`}>
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
                                                        <Link href={`/dashboard/crm/accounting/charts/${row._id}`}>
                                                            View ledger
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/dashboard/crm/accounting/charts/${row._id}/edit`}>
                                                            Edit
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/dashboard/crm/accounting/charts/${row._id}/activity`}>
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
