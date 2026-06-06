'use client';

import { Button, Input, Label, Popover, ZoruPopoverContent, ZoruPopoverTrigger, useZoruToast } from '@/components/sabcrm/20ui/compat';
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
                <Popover open={approveOpen} onOpenChange={setApproveOpen}>
                    <ZoruPopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                        >
                            <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Approve
                        </Button>
                    </ZoruPopoverTrigger>
                    <ZoruPopoverContent align="end" className="w-72 space-y-2">
                        <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                            Approval notes (optional)
                        </Label>
                        <Input
                            value={approveNotes}
                            onChange={(e) => setApproveNotes(e.target.value)}
                            placeholder="e.g. matches stock take"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setApproveOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleApprove}>
                                Confirm
                            </Button>
                        </div>
                    </ZoruPopoverContent>
                </Popover>
            ) : null}

            {status !== 'rejected' ? (
                <Popover open={rejectOpen} onOpenChange={setRejectOpen}>
                    <ZoruPopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                        >
                            <CircleX className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Reject
                        </Button>
                    </ZoruPopoverTrigger>
                    <ZoruPopoverContent align="end" className="w-72 space-y-2">
                        <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                            Rejection reason
                        </Label>
                        <Input
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                            placeholder="e.g. count error"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setRejectOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleReject}>
                                Confirm
                            </Button>
                        </div>
                    </ZoruPopoverContent>
                </Popover>
            ) : null}

            <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                disabled={pending}
                className="text-zoru-danger-ink"
            >
                <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
                Delete
            </Button>

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
