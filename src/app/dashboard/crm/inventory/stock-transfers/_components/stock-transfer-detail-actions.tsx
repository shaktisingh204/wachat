'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { Archive,
  Ban,
  Trash2 } from 'lucide-react';

/**
 * <StockTransferDetailActions /> — header action group rendered next to
 * the title on the detail page. Owns the cancel + archive + delete flows
 * (delete is router-redirected to the list once it succeeds).
 */

import * as React from 'react';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import {
    archiveStockTransfer,
    cancelStockTransfer,
    deleteStockTransfer,
} from '@/app/actions/crm-stock-transfers.actions';

export interface StockTransferDetailActionsProps {
    id: string;
    status: string;
}

const BASE = '/dashboard/crm/inventory/stock-transfers';

export function StockTransferDetailActions({
    id,
    status,
}: StockTransferDetailActionsProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [pending, startTransition] = React.useTransition();
    const [archiveOpen, setArchiveOpen] = React.useState(false);
    const [cancelOpen, setCancelOpen] = React.useState(false);
    const [deleteOpen, setDeleteOpen] = React.useState(false);

    function handleArchive() {
        startTransition(async () => {
            const res = await archiveStockTransfer(id);
            if (res.success) {
                toast({ title: 'Stock transfer archived' });
                router.refresh();
            } else {
                toast({
                    title: 'Archive failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
            setArchiveOpen(false);
        });
    }

    function handleCancel() {
        startTransition(async () => {
            const res = await cancelStockTransfer(id);
            if (res.success) {
                toast({ title: 'Stock transfer cancelled' });
                router.refresh();
            } else {
                toast({
                    title: 'Cancel failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
            setCancelOpen(false);
        });
    }

    function handleDelete() {
        startTransition(async () => {
            const res = await deleteStockTransfer(id);
            if (res.success) {
                toast({ title: 'Stock transfer deleted' });
                router.push(BASE);
            } else {
                toast({
                    title: 'Delete failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
            setDeleteOpen(false);
        });
    }

    return (
        <>
            {status !== 'Cancelled' && status !== 'archived' ? (
                <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setCancelOpen(true)}
                >
                    <Ban className="h-3.5 w-3.5" strokeWidth={1.75} /> Cancel
                </Button>
            ) : null}

            {status !== 'archived' ? (
                <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setArchiveOpen(true)}
                >
                    <Archive className="h-3.5 w-3.5" strokeWidth={1.75} /> Archive
                </Button>
            ) : null}

            <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setDeleteOpen(true)}
                className="text-zoru-danger-ink"
            >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} /> Delete
            </Button>

            <ConfirmDialog
                open={cancelOpen}
                onOpenChange={setCancelOpen}
                title="Cancel this stock transfer?"
                description="The transfer will be marked as cancelled. Inventory is not auto-reversed."
                confirmLabel="Confirm cancel"
                onConfirm={handleCancel}
            />
            <ConfirmDialog
                open={archiveOpen}
                onOpenChange={setArchiveOpen}
                title="Archive this stock transfer?"
                description="Archived transfers stay in the database but are hidden from the default list."
                confirmLabel="Archive"
                onConfirm={handleArchive}
            />
            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Delete this stock transfer?"
                description="This permanently removes the record. Inventory already moved is NOT auto-reversed."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleDelete}
            />
        </>
    );
}

export default StockTransferDetailActions;
