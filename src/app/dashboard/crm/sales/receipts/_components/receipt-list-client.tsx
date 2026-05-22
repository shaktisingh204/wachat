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
  CheckCircle2,
  XCircle,
  FileText } from 'lucide-react';

/**
 * Payment receipts table — 11 columns per §1D.1:
 *
 *   select · Receipt no · Customer · Date · Mode · Bank · Cheque/Reference
 *   · Amount · Status · Applied to invoices (count chip) · Actions
 *
 * Selection, row click → detail, inline status pill, mode pill. The
 * Mark Cleared / Mark Bounced inline actions live on each row's
 * action menu.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { setPaymentReceiptStatus } from '@/app/actions/crm/payment-receipts.actions';
import type { CrmPaymentReceiptDoc } from '@/lib/rust-client/crm-payment-receipts';

export type ReceiptListPreset = 'all' | 'this_month' | 'bounced' | 'pending_clearance';

interface ReceiptListClientProps {
    receipts: CrmPaymentReceiptDoc[];
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

function modeLabel(mode: string | undefined): string {
    if (!mode) return '—';
    const map: Record<string, string> = {
        cash: 'Cash',
        cheque: 'Cheque',
        upi: 'UPI',
        neft: 'NEFT',
        rtgs: 'RTGS',
        imps: 'IMPS',
        card: 'Card',
        wallet: 'Wallet',
    };
    return map[mode] ?? mode;
}

export function ReceiptListClient({
    receipts,
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onDelete,
}: ReceiptListClientProps) {
    const { toast } = useZoruToast();
    const [pendingId, startTransition] = React.useTransition();
    const [busyId, setBusyId] = React.useState<string | null>(null);

    const allSelected =
        receipts.length > 0 && receipts.every((r) => selectedIds.has(String(r._id)));
    const someSelected =
        receipts.some((r) => selectedIds.has(String(r._id))) && !allSelected;

    const inlineSetStatus = (id: string, status: 'cleared' | 'bounced') => {
        setBusyId(id);
        startTransition(async () => {
            const res = await setPaymentReceiptStatus(id, status);
            setBusyId(null);
            if (res.success) {
                toast({ title: `Marked ${status}` });
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
                <ZoruTableHeader>
                    <ZoruTableRow>
                        <ZoruTableHead className="w-[36px]">
                            <Checkbox
                                checked={allSelected}
                                aria-checked={someSelected ? 'mixed' : allSelected}
                                onCheckedChange={(v) => onToggleAll(v === true)}
                                aria-label="Select all"
                            />
                        </ZoruTableHead>
                        <ZoruTableHead>Receipt #</ZoruTableHead>
                        <ZoruTableHead>Customer</ZoruTableHead>
                        <ZoruTableHead>Date</ZoruTableHead>
                        <ZoruTableHead>Mode</ZoruTableHead>
                        <ZoruTableHead>Bank</ZoruTableHead>
                        <ZoruTableHead>Cheque / Ref</ZoruTableHead>
                        <ZoruTableHead className="text-right">Amount</ZoruTableHead>
                        <ZoruTableHead>Status</ZoruTableHead>
                        <ZoruTableHead className="text-right">Applied</ZoruTableHead>
                        <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {receipts.length === 0 ? (
                        <ZoruTableRow>
                            <ZoruTableCell
                                colSpan={11}
                                className="h-24 text-center text-[13px] text-zoru-ink-muted"
                            >
                                {loading ? 'Loading…' : 'No payment receipts.'}
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        receipts.map((r) => {
                            const id = String(r._id);
                            const isChecked = selectedIds.has(id);
                            const refLabel = r.chequeNo || r.txnId || r.reference || '—';
                            const appliedCount = r.applyTo?.length ?? 0;
                            const statusLabel = r.status || 'received';
                            return (
                                <ZoruTableRow key={id}>
                                    <ZoruTableCell>
                                        <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={() => onToggleOne(id)}
                                            aria-label={`Select ${r.receiptNo}`}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <EntityRowLink
                                            href={`/dashboard/crm/sales/receipts/${id}`}
                                            label={r.receiptNo || id.slice(-6)}
                                            subtitle={fmtDate(r.date)}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {r.clientId ? (
                                            <EntityPickerChip entity="client" id={r.clientId} />
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {fmtDate(r.date)}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <Badge variant="outline">{modeLabel(r.mode)}</Badge>
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {r.bankAccountId ? (
                                            <EntityPickerChip
                                                entity="bankAccount"
                                                id={r.bankAccountId}
                                            />
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {refLabel}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right tabular-nums text-[12.5px] text-zoru-ink">
                                        {fmtMoney(r.amount, r.currency)}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <StatusPill
                                            label={statusLabel}
                                            tone={statusToTone(statusLabel)}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        {appliedCount > 0 ? (
                                            <Badge variant="secondary">
                                                <FileText className="mr-1 h-3 w-3" /> {appliedCount}
                                            </Badge>
                                        ) : (
                                            <span className="text-[12.5px] text-zoru-ink-muted">
                                                —
                                            </span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button size="sm" variant="ghost" asChild>
                                                <Link
                                                    href={`/dashboard/crm/sales/receipts/${id}/edit`}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Link>
                                            </Button>
                                            <DropdownMenu>
                                                <ZoruDropdownMenuTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        disabled={busyId === id || pendingId}
                                                    >
                                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                                    </Button>
                                                </ZoruDropdownMenuTrigger>
                                                <ZoruDropdownMenuContent align="end">
                                                    <ZoruDropdownMenuItem
                                                        onClick={() =>
                                                            inlineSetStatus(id, 'cleared')
                                                        }
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        Mark cleared
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem
                                                        onClick={() =>
                                                            inlineSetStatus(id, 'bounced')
                                                        }
                                                    >
                                                        <XCircle className="h-3.5 w-3.5" />
                                                        Mark bounced
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
                                            </DropdownMenu>
                                        </div>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            );
                        })
                    )}
                </ZoruTableBody>
            </Table>
        </Card>
    );
}
