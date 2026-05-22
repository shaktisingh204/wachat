'use client';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuSeparator,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  Pencil,
  Trash2,
  MoreHorizontal,
  BadgeDollarSign } from 'lucide-react';

/**
 * Debit Notes table — 10 columns per §1D.1:
 *
 *   select · DN no · Vendor · Linked bill · Date · Reason ·
 *   Amount · Refund mode · Status · Actions
 *
 * Buy-side mirror of `<CreditNoteListClient>`.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { setDebitNoteStatus } from '@/app/actions/crm/debit-notes.actions';
import type { CrmDebitNoteDoc } from '@/lib/rust-client/crm-debit-notes';

interface DebitNoteListClientProps {
    debitNotes: CrmDebitNoteDoc[];
    loading: boolean;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onDelete: (id: string) => void;
}

function fmtMoney(value?: number, currency?: string): string {
    if (typeof value !== 'number') return '—';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency || 'INR',
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${currency || 'INR'} ${value}`;
    }
}

function fmtDate(v?: string): string {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function reasonLabel(reason?: string): string {
    if (!reason) return '—';
    const map: Record<string, string> = {
        return: 'Return',
        discount: 'Discount',
        price_adjust: 'Price adj.',
        cancel: 'Cancellation',
        other: 'Other',
    };
    return map[reason] ?? reason;
}

function refundModeLabel(mode?: string): string {
    if (!mode) return '—';
    const map: Record<string, string> = {
        cash: 'Cash',
        credit: 'Credit',
        replacement: 'Replacement',
    };
    return map[mode] ?? mode;
}

export function DebitNoteListClient({
    debitNotes,
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onDelete,
}: DebitNoteListClientProps) {
    const { toast } = useZoruToast();
    const [pendingId, startTransition] = React.useTransition();
    const [busyId, setBusyId] = React.useState<string | null>(null);

    const allSelected =
        debitNotes.length > 0 &&
        debitNotes.every((d) => selectedIds.has(String(d._id)));
    const someSelected =
        debitNotes.some((d) => selectedIds.has(String(d._id))) && !allSelected;

    const markRefunded = (id: string) => {
        setBusyId(id);
        startTransition(async () => {
            const res = await setDebitNoteStatus(id, 'refunded');
            setBusyId(null);
            if (res.success) {
                toast({ title: 'Marked refunded' });
            } else {
                toast({
                    title: 'Update failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <ZoruCard className="overflow-hidden p-0">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow>
                        <ZoruTableHead className="w-[36px]">
                            <ZoruCheckbox
                                checked={allSelected}
                                aria-checked={someSelected ? 'mixed' : allSelected}
                                onCheckedChange={(v) => onToggleAll(v === true)}
                                aria-label="Select all"
                            />
                        </ZoruTableHead>
                        <ZoruTableHead>DN #</ZoruTableHead>
                        <ZoruTableHead>Vendor</ZoruTableHead>
                        <ZoruTableHead>Linked bill</ZoruTableHead>
                        <ZoruTableHead>Date</ZoruTableHead>
                        <ZoruTableHead>Reason</ZoruTableHead>
                        <ZoruTableHead className="text-right">Amount</ZoruTableHead>
                        <ZoruTableHead>Refund mode</ZoruTableHead>
                        <ZoruTableHead>Status</ZoruTableHead>
                        <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {debitNotes.length === 0 ? (
                        <ZoruTableRow>
                            <ZoruTableCell
                                colSpan={10}
                                className="h-24 text-center text-[13px] text-zoru-ink-muted"
                            >
                                {loading ? 'Loading…' : 'No debit notes.'}
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        debitNotes.map((dn) => {
                            const id = String(dn._id);
                            const isChecked = selectedIds.has(id);
                            const statusLabel = dn.status || 'draft';
                            return (
                                <ZoruTableRow key={id}>
                                    <ZoruTableCell>
                                        <ZoruCheckbox
                                            checked={isChecked}
                                            onCheckedChange={() => onToggleOne(id)}
                                            aria-label={`Select ${dn.dnNo}`}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <EntityRowLink
                                            href={`/dashboard/crm/purchases/debit-notes/${id}`}
                                            label={dn.dnNo || id.slice(-6)}
                                            subtitle={dn.linkedBillId ? `Bill ${dn.linkedBillId.slice(-6)}` : undefined}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {dn.vendorId ? (
                                            <EntityPickerChip entity="vendor" id={dn.vendorId} />
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {dn.linkedBillId ? (
                                            <Link
                                                href={`/dashboard/crm/purchases/expenses/${dn.linkedBillId}`}
                                                className="hover:underline"
                                            >
                                                {dn.linkedBillId.slice(-8)}
                                            </Link>
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {fmtDate(dn.date)}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <ZoruBadge variant="outline">
                                            {reasonLabel(dn.reason)}
                                        </ZoruBadge>
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right tabular-nums text-[12.5px] text-zoru-ink">
                                        {fmtMoney(dn.totals?.total, dn.currency)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {refundModeLabel(dn.refundMode)}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <StatusPill
                                            label={statusLabel}
                                            tone={statusToTone(statusLabel)}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <ZoruButton size="sm" variant="ghost" asChild>
                                                <Link
                                                    href={`/dashboard/crm/purchases/debit-notes/${id}/edit`}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Link>
                                            </ZoruButton>
                                            <ZoruDropdownMenu>
                                                <ZoruDropdownMenuTrigger asChild>
                                                    <ZoruButton
                                                        size="sm"
                                                        variant="ghost"
                                                        disabled={busyId === id || pendingId}
                                                    >
                                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                                    </ZoruButton>
                                                </ZoruDropdownMenuTrigger>
                                                <ZoruDropdownMenuContent align="end">
                                                    <ZoruDropdownMenuItem
                                                        onClick={() => markRefunded(id)}
                                                    >
                                                        <BadgeDollarSign className="h-3.5 w-3.5" />
                                                        Mark refunded
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuSeparator />
                                                    <ZoruDropdownMenuItem
                                                        onClick={() => onDelete(id)}
                                                        className="text-zoru-danger-ink"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
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
        </ZoruCard>
    );
}
