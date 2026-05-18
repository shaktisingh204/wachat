'use client';

import { ZoruButton, ZoruInput, ZoruLabel, ZoruPopover, ZoruPopoverContent, ZoruPopoverTrigger, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { Archive,
  BadgeCheck,
  CircleX } from 'lucide-react';

/**
 * Client-side action buttons rendered in the adjustment detail header.
 * Owns the Approve / Reject / Archive (delete) flows. Approve & reject
 * are typed-confirm friendly through a popover note field.
 */

import * as React from 'react';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import {
    approveCrmStockAdjustment,
    deleteCrmStockAdjustment,
    rejectCrmStockAdjustment,
} from '@/app/actions/crm-inventory.actions';

export interface AdjustmentDetailActionsProps {
    id: string;
    status: string;
}

export function AdjustmentDetailActions({
    id,
    status,
}: AdjustmentDetailActionsProps) {
    const router = useRouter();
    const { toast } = useZoruToast();

    const [approveNotes, setApproveNotes] = React.useState('');
    const [rejectNotes, setRejectNotes] = React.useState('');
    const [approveOpen, setApproveOpen] = React.useState(false);
    const [rejectOpen, setRejectOpen] = React.useState(false);
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [pending, startTransition] = React.useTransition();

    function handleApprove() {
        startTransition(async () => {
            const res = await approveCrmStockAdjustment(id, approveNotes);
            if (res.success) {
                toast({ title: 'Adjustment approved' });
                router.refresh();
            } else {
                toast({
                    title: 'Approve failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
            setApproveOpen(false);
            setApproveNotes('');
        });
    }

    function handleReject() {
        startTransition(async () => {
            const res = await rejectCrmStockAdjustment(id, rejectNotes);
            if (res.success) {
                toast({ title: 'Adjustment rejected' });
                router.refresh();
            } else {
                toast({
                    title: 'Reject failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
            setRejectOpen(false);
            setRejectNotes('');
        });
    }

    function handleDelete() {
        startTransition(async () => {
            const res = await deleteCrmStockAdjustment(id);
            if (res.success) {
                toast({ title: 'Adjustment deleted' });
                router.push('/dashboard/crm/inventory/adjustments');
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
            {status !== 'approved' ? (
                <ZoruPopover open={approveOpen} onOpenChange={setApproveOpen}>
                    <ZoruPopoverTrigger asChild>
                        <ZoruButton
                            variant="outline"
                            size="sm"
                            disabled={pending}
                        >
                            <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Approve
                        </ZoruButton>
                    </ZoruPopoverTrigger>
                    <ZoruPopoverContent align="end" className="w-72 space-y-2">
                        <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                            Approval notes (optional)
                        </ZoruLabel>
                        <ZoruInput
                            value={approveNotes}
                            onChange={(e) => setApproveNotes(e.target.value)}
                            placeholder="e.g. matches stock take"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                            <ZoruButton
                                size="sm"
                                variant="ghost"
                                onClick={() => setApproveOpen(false)}
                            >
                                Cancel
                            </ZoruButton>
                            <ZoruButton size="sm" onClick={handleApprove}>
                                Confirm
                            </ZoruButton>
                        </div>
                    </ZoruPopoverContent>
                </ZoruPopover>
            ) : null}

            {status !== 'rejected' ? (
                <ZoruPopover open={rejectOpen} onOpenChange={setRejectOpen}>
                    <ZoruPopoverTrigger asChild>
                        <ZoruButton
                            variant="outline"
                            size="sm"
                            disabled={pending}
                        >
                            <CircleX className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Reject
                        </ZoruButton>
                    </ZoruPopoverTrigger>
                    <ZoruPopoverContent align="end" className="w-72 space-y-2">
                        <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                            Rejection reason
                        </ZoruLabel>
                        <ZoruInput
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                            placeholder="e.g. count error"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                            <ZoruButton
                                size="sm"
                                variant="ghost"
                                onClick={() => setRejectOpen(false)}
                            >
                                Cancel
                            </ZoruButton>
                            <ZoruButton size="sm" onClick={handleReject}>
                                Confirm
                            </ZoruButton>
                        </div>
                    </ZoruPopoverContent>
                </ZoruPopover>
            ) : null}

            <ZoruButton
                variant="outline"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                disabled={pending}
                className="text-zoru-danger-ink"
            >
                <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
                Delete
            </ZoruButton>

            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Delete this adjustment?"
                description="This permanently removes the adjustment. Stock that was already applied is NOT reverted automatically."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleDelete}
            />
        </>
    );
}
