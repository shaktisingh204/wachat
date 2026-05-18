'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  Edit,
  Trash2 } from 'lucide-react';

/**
 * <BatchExpiryTable /> — sortable list of `crm_item_batches`.
 *
 * The list is server-rendered already sorted by `expiryDate ASC`. This
 * client component adds per-row delete + red highlighting for any batch
 * that is expired or within 30 days of its `expiryDate`. A status pill
 * mirrors the row tone.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deleteCrmItemBatch,
    type CrmItemBatchDoc,
} from '@/app/actions/crm-item-batches.actions';

const BASE = '/dashboard/crm/inventory/batch-expiry';

const SOON_DAYS = 30;

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function daysUntil(expiry: unknown): number | null {
    if (!expiry) return null;
    const d = new Date(expiry as string);
    if (Number.isNaN(d.getTime())) return null;
    const diff = d.getTime() - Date.now();
    return Math.floor(diff / 86_400_000);
}

interface ExpiryFlag {
    expired: boolean;
    soon: boolean;
    daysLeft: number | null;
}

function expiryFlag(expiry: unknown): ExpiryFlag {
    const days = daysUntil(expiry);
    if (days == null) return { expired: false, soon: false, daysLeft: null };
    return {
        expired: days < 0,
        soon: days >= 0 && days <= SOON_DAYS,
        daysLeft: days,
    };
}

function statusTone(b: CrmItemBatchDoc, flag: ExpiryFlag): StatusTone {
    if (b.status === 'recalled') return 'red';
    if (b.status === 'archived') return 'neutral';
    if (flag.expired) return 'red';
    if (flag.soon) return 'amber';
    return 'green';
}

function statusLabel(b: CrmItemBatchDoc, flag: ExpiryFlag): string {
    if (b.status === 'recalled') return 'recalled';
    if (b.status === 'archived') return 'archived';
    if (flag.expired) return 'expired';
    if (flag.soon && flag.daysLeft != null)
        return `expires in ${flag.daysLeft}d`;
    return b.status ?? 'active';
}

export function BatchExpiryTable({ batches }: { batches: CrmItemBatchDoc[] }) {
    const { toast } = useZoruToast();
    const [pendingDelete, setPendingDelete] =
        React.useState<CrmItemBatchDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const res = await deleteCrmItemBatch(id);
            if (res.success) {
                toast({ title: 'Batch deleted' });
                setPendingDelete(null);
            } else {
                toast({
                    title: 'Error',
                    description: res.error ?? 'Could not delete batch.',
                    variant: 'destructive',
                });
            }
        });
    };

    if (batches.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-zoru-line p-8 text-center">
                <p className="text-[14px] font-medium text-zoru-ink">
                    No batches yet
                </p>
                <p className="max-w-sm text-[12.5px] text-zoru-ink-muted">
                    Track manufacture and expiry dates for batch-managed items to
                    reduce wastage and stay compliant.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
                <ZoruTable>
                    <ZoruTableHeader>
                        <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                            <ZoruTableHead className="text-zoru-ink-muted">
                                Item
                            </ZoruTableHead>
                            <ZoruTableHead className="text-zoru-ink-muted">
                                Batch no.
                            </ZoruTableHead>
                            <ZoruTableHead className="text-zoru-ink-muted">
                                Manufacture
                            </ZoruTableHead>
                            <ZoruTableHead className="text-zoru-ink-muted">
                                Expiry
                            </ZoruTableHead>
                            <ZoruTableHead className="text-zoru-ink-muted text-right">
                                Qty
                            </ZoruTableHead>
                            <ZoruTableHead className="text-zoru-ink-muted">
                                Status
                            </ZoruTableHead>
                            <ZoruTableHead className="text-zoru-ink-muted text-right">
                                Actions
                            </ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {batches.map((b) => {
                            const flag = expiryFlag(b.expiryDate);
                            const danger = flag.expired || flag.soon;
                            return (
                                <ZoruTableRow
                                    key={b._id}
                                    className={
                                        flag.expired
                                            ? 'border-zoru-line bg-red-50 dark:bg-red-950/30'
                                            : flag.soon
                                              ? 'border-zoru-line bg-amber-50/50 dark:bg-amber-950/20'
                                              : 'border-zoru-line'
                                    }
                                >
                                    <ZoruTableCell className="font-medium text-zoru-ink">
                                        <Link
                                            href={`${BASE}/${b._id}`}
                                            className="hover:underline"
                                        >
                                            {b.itemName}
                                        </Link>
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                        {b.batchNumber}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-zoru-ink">
                                        {fmtDate(b.manufactureDate)}
                                    </ZoruTableCell>
                                    <ZoruTableCell
                                        className={
                                            danger
                                                ? 'font-medium text-red-700 dark:text-red-300'
                                                : 'text-zoru-ink'
                                        }
                                    >
                                        {fmtDate(b.expiryDate)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                        {b.quantity}
                                        {b.unit ? ` ${b.unit}` : ''}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <StatusPill
                                            label={statusLabel(b, flag)}
                                            tone={statusTone(b, flag)}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <ZoruButton variant="ghost" size="icon" asChild>
                                            <Link href={`${BASE}/${b._id}/edit`}>
                                                <Edit className="h-4 w-4" />
                                            </Link>
                                        </ZoruButton>
                                        <ZoruButton
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setPendingDelete(b)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </ZoruButton>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            );
                        })}
                    </ZoruTableBody>
                </ZoruTable>
            </div>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete batch?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting batch &ldquo;{pendingDelete?.batchNumber}&rdquo;
                            removes it from the list. This cannot be undone.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
