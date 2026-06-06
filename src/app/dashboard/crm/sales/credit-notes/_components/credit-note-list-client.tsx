'use client';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useZoruToast,
  cn,
} from '@/components/sabcrm/20ui/compat';
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
import { fmtDate, fmtINR } from '@/lib/utils';

interface CreditNoteListClientProps {
    creditNotes: CrmCreditNoteDoc[];
    loading: boolean;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onDelete: (id: string) => void;
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
        <Card className="overflow-hidden p-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[36px]">
                            <Checkbox
                                checked={allSelected}
                                aria-checked={someSelected ? 'mixed' : allSelected}
                                onCheckedChange={(v) => onToggleAll(v === true)}
                                aria-label="Select all"
                            />
                        </TableHead>
                        <TableHead>CN #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Linked invoice</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Refund mode</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {creditNotes.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={10}
                                className="h-24 text-center text-[13px] text-zoru-ink-muted"
                            >
                                {loading ? 'Loading…' : 'No credit notes.'}
                            </TableCell>
                        </TableRow>
                    ) : (
                        creditNotes.map((cn) => {
                            const id = String(cn._id);
                            const isChecked = selectedIds.has(id);
                            const statusLabel = cn.status || 'draft';
                            return (
                                <TableRow key={id}>
                                    <TableCell>
                                        <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={() => onToggleOne(id)}
                                            aria-label={`Select ${cn.cnNo}`}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <EntityRowLink
                                            href={`/dashboard/crm/sales/credit-notes/${id}`}
                                            label={cn.cnNo || id.slice(-6)}
                                            subtitle={fmtDate(cn.date)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {cn.clientId ? (
                                            <EntityPickerChip entity="client" id={cn.clientId} />
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    <TableCell className="text-[12.5px] text-zoru-ink-muted">
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
                                    </TableCell>
                                    <TableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {fmtDate(cn.date)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {reasonLabel(cn.reason)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-[12.5px] text-zoru-ink">
                                        {fmtINR(cn.totals?.total, cn.currency)}
                                    </TableCell>
                                    <TableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {refundModeLabel(cn.refundMode)}
                                    </TableCell>
                                    <TableCell>
                                        <StatusPill
                                            label={statusLabel}
                                            tone={statusToTone(statusLabel)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button size="sm" variant="ghost" asChild>
                                                <Link
                                                    href={`/dashboard/crm/sales/credit-notes/${id}/edit`}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Link>
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        disabled={busyId === id || pendingId}
                                                    >
                                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={() => markRefunded(id)}
                                                    >
                                                        <BadgeDollarSign className="h-3.5 w-3.5" />
                                                        Mark refunded
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => onDelete(id)}
                                                        className="text-zoru-danger-ink"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </Card>
    );
}
