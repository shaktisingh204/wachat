'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
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
    const { toast } = useToast();
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
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--st-border)] p-8 text-center">
                <p className="text-[14px] font-medium text-[var(--st-text)]">
                    No batches yet
                </p>
                <p className="max-w-sm text-[12.5px] text-[var(--st-text-secondary)]">
                    Track manufacture and expiry dates for batch-managed items to
                    reduce wastage and stay compliant.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                <Table>
                    <THead>
                        <Tr className="border-[var(--st-border)] hover:bg-transparent">
                            <Th className="text-[var(--st-text-secondary)]">
                                Item
                            </Th>
                            <Th className="text-[var(--st-text-secondary)]">
                                Batch no.
                            </Th>
                            <Th className="text-[var(--st-text-secondary)]">
                                Manufacture
                            </Th>
                            <Th className="text-[var(--st-text-secondary)]">
                                Expiry
                            </Th>
                            <Th className="text-[var(--st-text-secondary)] text-right">
                                Qty
                            </Th>
                            <Th className="text-[var(--st-text-secondary)]">
                                Status
                            </Th>
                            <Th className="text-[var(--st-text-secondary)] text-right">
                                Actions
                            </Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {batches.map((b) => {
                            const flag = expiryFlag(b.expiryDate);
                            const danger = flag.expired || flag.soon;
                            return (
                                <Tr
                                    key={b._id}
                                    className={
                                        flag.expired
                                            ? 'border-[var(--st-border)] bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/30'
                                            : flag.soon
                                              ? 'border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 dark:bg-[var(--st-text)]/20'
                                              : 'border-[var(--st-border)]'
                                    }
                                >
                                    <Td className="font-medium text-[var(--st-text)]">
                                        <Link
                                            href={`${BASE}/${b._id}`}
                                            className="hover:underline"
                                        >
                                            {b.itemName}
                                        </Link>
                                    </Td>
                                    <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                        {b.batchNumber}
                                    </Td>
                                    <Td className="text-[var(--st-text)]">
                                        {fmtDate(b.manufactureDate)}
                                    </Td>
                                    <Td
                                        className={
                                            danger
                                                ? 'font-medium text-[var(--st-text)] dark:text-[var(--st-text-secondary)]'
                                                : 'text-[var(--st-text)]'
                                        }
                                    >
                                        {fmtDate(b.expiryDate)}
                                    </Td>
                                    <Td className="text-right font-mono text-[var(--st-text)]">
                                        {b.quantity}
                                        {b.unit ? ` ${b.unit}` : ''}
                                    </Td>
                                    <Td>
                                        <StatusPill
                                            label={statusLabel(b, flag)}
                                            tone={statusTone(b, flag)}
                                        />
                                    </Td>
                                    <Td className="text-right">
                                        <Button variant="ghost" size="icon" asChild>
                                            <Link href={`${BASE}/${b._id}/edit`}>
                                                <Edit className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setPendingDelete(b)}
                                        >
                                            <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                        </Button>
                                    </Td>
                                </Tr>
                            );
                        })}
                    </TBody>
                </Table>
            </div>

            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete batch?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting batch &ldquo;{pendingDelete?.batchNumber}&rdquo;
                            removes it from the list. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
