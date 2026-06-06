'use client';

import {
  Button,
  Checkbox,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/sabcrm/20ui/compat';
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
import type { PaymentAccountRow } from './types';

function mask(account?: string): string {
    if (!account) return '—';
    const trimmed = account.replace(/\s+/g, '');
    if (trimmed.length <= 4) return trimmed;
    return `••••${trimmed.slice(-4)}`;
}

function fmtMoney(value: number | undefined, currency: string): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(value ?? 0);
    } catch {
        return `${currency} ${(value ?? 0).toFixed(2)}`;
    }
}

interface PaymentAccountsTableProps {
    rows: PaymentAccountRow[];
    loading: boolean;
    selection: Set<string>;
    onToggle: (id: string) => void;
    onToggleAll: (next: boolean) => void;
    onDelete: (row: PaymentAccountRow) => void;
    /** When true (employee tab), hide bank-specific columns. */
    compact?: boolean;
}

export function PaymentAccountsTable({
    rows,
    loading,
    selection,
    onToggle,
    onToggleAll,
    onDelete,
    compact,
}: PaymentAccountsTableProps) {
    const allSelected = rows.length > 0 && rows.every((r) => selection.has(r._id));
    const someSelected = !allSelected && rows.some((r) => selection.has(r._id));

    return (
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                        <ZoruTableHead className="w-10 text-[var(--st-text-secondary)]">
                            <Checkbox
                                checked={allSelected}
                                data-indeterminate={someSelected ? 'true' : undefined}
                                onCheckedChange={(v) => onToggleAll(Boolean(v))}
                                aria-label="Select all rows"
                            />
                        </ZoruTableHead>
                        <ZoruTableHead className="text-[var(--st-text-secondary)]">Name</ZoruTableHead>
                        {!compact ? <ZoruTableHead className="text-[var(--st-text-secondary)]">Bank</ZoruTableHead> : null}
                        {!compact ? (
                            <ZoruTableHead className="text-[var(--st-text-secondary)]">Account no</ZoruTableHead>
                        ) : null}
                        {!compact ? <ZoruTableHead className="text-[var(--st-text-secondary)]">IFSC</ZoruTableHead> : null}
                        <ZoruTableHead className="text-[var(--st-text-secondary)]">Type</ZoruTableHead>
                        <ZoruTableHead className="text-[var(--st-text-secondary)]">Currency</ZoruTableHead>
                        <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">Balance</ZoruTableHead>
                        <ZoruTableHead className="text-[var(--st-text-secondary)]">Default</ZoruTableHead>
                        <ZoruTableHead className="text-[var(--st-text-secondary)]">Status</ZoruTableHead>
                        <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {loading ? (
                        <ZoruTableRow className="border-[var(--st-border)]">
                            <ZoruTableCell colSpan={compact ? 8 : 11} className="h-24 text-center">
                                <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : rows.length === 0 ? (
                        <ZoruTableRow className="border-[var(--st-border)]">
                            <ZoruTableCell colSpan={compact ? 8 : 11} className="h-24 text-center text-[var(--st-text-secondary)]">
                                No accounts in this tab.
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        rows.map((row) => {
                            const checked = selection.has(row._id);
                            return (
                                <ZoruTableRow
                                    key={row._id}
                                    className="border-[var(--st-border)]"
                                    data-state={checked ? 'selected' : undefined}
                                >
                                    <ZoruTableCell>
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={() => onToggle(row._id)}
                                            aria-label={`Select ${row.accountName}`}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-medium">
                                        <EntityRowLink
                                            href={`/dashboard/crm/banking/all/${row._id}`}
                                            label={row.accountName}
                                            subtitle={row.bankDetails?.bankName || undefined}
                                        />
                                    </ZoruTableCell>
                                    {!compact ? (
                                        <ZoruTableCell className="text-[var(--st-text)]">
                                            {row.bankDetails?.bankName || '—'}
                                        </ZoruTableCell>
                                    ) : null}
                                    {!compact ? (
                                        <ZoruTableCell className="font-mono text-[12px] text-[var(--st-text)]">
                                            {mask(row.bankDetails?.accountNumber)}
                                        </ZoruTableCell>
                                    ) : null}
                                    {!compact ? (
                                        <ZoruTableCell className="font-mono text-[12px] text-[var(--st-text)]">
                                            {row.bankDetails?.ifsc || '—'}
                                        </ZoruTableCell>
                                    ) : null}
                                    <ZoruTableCell className="capitalize text-[12.5px] text-[var(--st-text)]">
                                        {row.accountType}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-[12px] text-[var(--st-text-secondary)]">
                                        {row.currency}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-[var(--st-text)]">
                                        {fmtMoney(row.currentBalance ?? row.openingBalance, row.currency)}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {row.isDefault ? (
                                            <CheckCircle className="h-4 w-4 text-[var(--st-text)]" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-[var(--st-text-secondary)]" />
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <StatusPill
                                            label={row.status}
                                            tone={row.status === 'active' ? 'green' : 'neutral'}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <div className="flex justify-end items-center gap-1">
                                            <Button asChild variant="ghost" size="icon">
                                                <Link href={`/dashboard/crm/banking/all/${row._id}/edit`}>
                                                    <Edit className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                            <ZoruDropdownMenu>
                                                <ZoruDropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" aria-label="More actions">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </ZoruDropdownMenuTrigger>
                                                <ZoruDropdownMenuContent align="end">
                                                    <ZoruDropdownMenuItem asChild>
                                                        <Link href={`/dashboard/crm/banking/all/${row._id}`}>
                                                            View
                                                        </Link>
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem asChild>
                                                        <Link href={`/dashboard/crm/banking/all/${row._id}/edit`}>
                                                            Edit
                                                        </Link>
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem asChild>
                                                        <Link href={`/dashboard/crm/banking/all/${row._id}/activity`}>
                                                            Activity
                                                        </Link>
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem asChild>
                                                        <Link href="/dashboard/crm/banking/reconciliation">
                                                            Reconcile
                                                        </Link>
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem onSelect={() => onDelete(row)}>
                                                        <Trash2 className="mr-2 h-3.5 w-3.5 text-[var(--st-text)]" />
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
