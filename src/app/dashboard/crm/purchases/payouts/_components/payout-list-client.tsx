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
 * Payouts table — 11 columns per §1D.1:
 *
 *   select · Payment no · Vendor · Date · Mode · Bank · Cheque/Ref ·
 *   Amount · Status · Applied (count chip) · Actions
 *
 * Selection-aware; selection state lives in the parent list page so
 * the bulk-action bar can read it. Mark Cleared / Mark Failed actions
 * live on each row's overflow menu.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { setPayoutStatus } from '@/app/actions/crm/payouts.actions';
import type { CrmPayoutDoc } from '@/lib/rust-client/crm-payouts';

interface PayoutListClientProps {
    payouts: CrmPayoutDoc[];
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

export function PayoutListClient({
    payouts,
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onDelete,
}: PayoutListClientProps) {
    const { toast } = useZoruToast();
    const [pendingId, startTransition] = React.useTransition();
    const [busyId, setBusyId] = React.useState<string | null>(null);

    const allSelected =
        payouts.length > 0 && payouts.every((p) => selectedIds.has(String(p._id)));
    const someSelected =
        payouts.some((p) => selectedIds.has(String(p._id))) && !allSelected;

    const inlineSetStatus = (id: string, status: 'cleared' | 'failed') => {
        setBusyId(id);
        startTransition(async () => {
            const res = await setPayoutStatus(id, status);
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
                        <ZoruTableHead>Payment #</ZoruTableHead>
                        <ZoruTableHead>Vendor</ZoruTableHead>
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
                    {payouts.length === 0 ? (
                        <ZoruTableRow>
                            <ZoruTableCell
                                colSpan={11}
                                className="h-24 text-center text-[13px] text-zoru-ink-muted"
                            >
                                {loading ? 'Loading…' : 'No payouts.'}
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        payouts.map((p) => {
                            const id = String(p._id);
                            const isChecked = selectedIds.has(id);
                            const refLabel = p.chequeNo || p.txnId || p.reference || '—';
                            const appliedCount = p.applyTo?.length ?? 0;
                            const statusLabel = p.status || 'sent';
                            return (
                                <ZoruTableRow key={id}>
                                    <ZoruTableCell>
                                        <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={() => onToggleOne(id)}
                                            aria-label={`Select ${p.paymentNo}`}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <EntityRowLink
                                            href={`/dashboard/crm/purchases/payouts/${id}`}
                                            label={p.paymentNo || id.slice(-6)}
                                            subtitle={refLabel !== '—' ? refLabel : undefined}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {p.vendorId ? (
                                            <EntityPickerChip entity="vendor" id={p.vendorId} />
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {fmtDate(p.date)}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <Badge variant="outline">{modeLabel(p.mode)}</Badge>
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {p.bankAccountId ? (
                                            <EntityPickerChip
                                                entity="bankAccount"
                                                id={p.bankAccountId}
                                            />
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {refLabel}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right tabular-nums text-[12.5px] text-zoru-ink">
                                        {fmtMoney(p.amount, p.currency)}
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
                                                    href={`/dashboard/crm/purchases/payouts/${id}/edit`}
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
                                                            inlineSetStatus(id, 'failed')
                                                        }
                                                    >
                                                        <XCircle className="h-3.5 w-3.5" />
                                                        Mark failed
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
