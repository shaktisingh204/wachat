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
  cn,
} from '@/components/zoruui';
import {
  Pencil,
  Trash2,
  MoreHorizontal,
  BadgeDollarSign,
  } from 'lucide-react';

/**
 * Credit Notes table — 10 columns per §1D.1:
 *
 *   select · CN no · Customer · Linked invoice · Date · Reason ·
 *   Amount · Refund mode · Status · Actions
 *
 * Selection-aware; selection state lives in the parent list page so the
 * bulk-action bar can read it. Status pill uses the shared
 * `statusToTone()` helper.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { setCreditNoteStatus } from '@/app/actions/crm/credit-notes.actions';
import type { CrmCreditNoteDoc } from '@/lib/rust-client/crm-credit-notes';

interface CreditNoteListClientProps {
    creditNotes: CrmCreditNoteDoc[];
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

export function CreditNoteListClient({
    creditNotes,
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onDelete,
}: CreditNoteListClientProps) {
    const { toast } = useZoruToast();
    const [pendingId, startTransition] = React.useTransition();
    const [busyId, setBusyId] = React.useState<string | null>(null);

    const allSelected =
        creditNotes.length > 0 &&
        creditNotes.every((c) => selectedIds.has(String(c._id)));
    const someSelected =
        creditNotes.some((c) => selectedIds.has(String(c._id))) && !allSelected;

    const markRefunded = (id: string) => {
        setBusyId(id);
        startTransition(async () => {
            const res = await setCreditNoteStatus(id, 'refunded');
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
                        <ZoruTableHead>CN #</ZoruTableHead>
                        <ZoruTableHead>Customer</ZoruTableHead>
                        <ZoruTableHead>Linked invoice</ZoruTableHead>
                        <ZoruTableHead>Date</ZoruTableHead>
                        <ZoruTableHead>Reason</ZoruTableHead>
                        <ZoruTableHead className="text-right">Amount</ZoruTableHead>
                        <ZoruTableHead>Refund mode</ZoruTableHead>
                        <ZoruTableHead>Status</ZoruTableHead>
                        <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {creditNotes.length === 0 ? (
                        <ZoruTableRow>
                            <ZoruTableCell
                                colSpan={10}
                                className="h-24 text-center text-[13px] text-zoru-ink-muted"
                            >
                                {loading ? 'Loading…' : 'No credit notes.'}
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        creditNotes.map((cn) => {
                            const id = String(cn._id);
                            const isChecked = selectedIds.has(id);
                            const statusLabel = cn.status || 'draft';
                            return (
                                <ZoruTableRow key={id}>
                                    <ZoruTableCell>
                                        <ZoruCheckbox
                                            checked={isChecked}
                                            onCheckedChange={() => onToggleOne(id)}
                                            aria-label={`Select ${cn.cnNo}`}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <EntityRowLink
                                            href={`/dashboard/crm/sales/credit-notes/${id}`}
                                            label={cn.cnNo || id.slice(-6)}
                                            subtitle={fmtDate(cn.date)}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {cn.clientId ? (
                                            <EntityPickerChip entity="client" id={cn.clientId} />
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {cn.linkedInvoiceId ? (
                                            <Link
                                                href={`/dashboard/crm/sales/invoices/${cn.linkedInvoiceId}`}
                                                className="hover:underline"
                                            >
                                                {cn.linkedInvoiceId.slice(-8)}
                                            </Link>
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {fmtDate(cn.date)}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <ZoruBadge variant="outline">
                                            {reasonLabel(cn.reason)}
                                        </ZoruBadge>
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right tabular-nums text-[12.5px] text-zoru-ink">
                                        {fmtMoney(cn.totals?.total, cn.currency)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {refundModeLabel(cn.refundMode)}
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
                                                    href={`/dashboard/crm/sales/credit-notes/${id}/edit`}
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
