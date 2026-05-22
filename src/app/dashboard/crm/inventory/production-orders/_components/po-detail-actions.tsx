'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
    Activity,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Edit,
  Pause,
  Play,
  Printer,
  RefreshCw,
  Send,
  } from 'lucide-react';

/**
 * Header actions for the production-order detail page (per §1D.2).
 *
 * Provides: Release · Start · Complete (→ update-yield) · Update yield ·
 * Print · Archive (cancel) buttons. Edit is wired separately via Link.
 */

import * as React from 'react';
import Link from 'next/link';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { setProductionOrderStatus } from '@/app/actions/crm-production-orders.actions';

export interface PoDetailActionsProps {
    orderId: string;
    orderNo: string;
    currentStatus: string;
}

type PoStatus =
    | 'planned'
    | 'released'
    | 'in_progress'
    | 'paused'
    | 'qa_check'
    | 'completed'
    | 'closed'
    | 'cancelled';

export function PoDetailActions({ orderId, orderNo, currentStatus }: PoDetailActionsProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [archiveOpen, setArchiveOpen] = React.useState(false);
    const [pending, startTransition] = React.useTransition();

    const onStatus = (status: PoStatus) => {
        startTransition(async () => {
            const res = await setProductionOrderStatus(orderId, status);
            if (res.success) {
                toast({ title: `Status → ${status}` });
                router.refresh();
            } else {
                toast({
                    title: 'Status update failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const onPrint = () => {
        if (typeof window !== 'undefined') window.print();
    };

    const onConfirmCancel = () => {
        onStatus('cancelled');
        setArchiveOpen(false);
    };

    const s = (currentStatus || '').toLowerCase();
    const isRunning = s === 'in_progress';
    const isTerminal = s === 'completed' || s === 'closed' || s === 'cancelled';

    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <ZoruButton size="sm" asChild>
                    <Link href={`/dashboard/crm/inventory/production-orders/${orderId}/edit`}>
                        <Edit className="h-3.5 w-3.5" /> Edit
                    </Link>
                </ZoruButton>
                <ZoruButton
                    size="sm"
                    variant="outline"
                    onClick={() => onStatus('released')}
                    disabled={
                        pending ||
                        s === 'released' ||
                        s === 'in_progress' ||
                        isTerminal
                    }
                >
                    <Send className="h-3.5 w-3.5" /> Release
                </ZoruButton>
                <ZoruButton
                    size="sm"
                    variant="outline"
                    onClick={() => onStatus('in_progress')}
                    disabled={pending || isRunning || isTerminal}
                >
                    <Play className="h-3.5 w-3.5" /> Start
                </ZoruButton>
                <ZoruButton
                    size="sm"
                    variant="outline"
                    onClick={() => onStatus('paused')}
                    disabled={pending || !isRunning}
                >
                    <Pause className="h-3.5 w-3.5" /> Pause
                </ZoruButton>
                <ZoruButton
                    size="sm"
                    variant="outline"
                    onClick={() => onStatus('qa_check')}
                    disabled={pending || isTerminal}
                >
                    <ClipboardCheck className="h-3.5 w-3.5" /> QC
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" asChild>
                    <Link
                        href={`/dashboard/crm/inventory/production-orders/${orderId}/update-yield`}
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                    </Link>
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" asChild>
                    <Link
                        href={`/dashboard/crm/inventory/production-orders/${orderId}/update-yield`}
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Update yield
                    </Link>
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" onClick={onPrint}>
                    <Printer className="h-3.5 w-3.5" /> Print
                </ZoruButton>
                <ZoruButton
                    size="sm"
                    variant="outline"
                    onClick={() => setArchiveOpen(true)}
                    disabled={pending}
                >
                    <Archive className="h-3.5 w-3.5" /> Cancel order
                </ZoruButton>
                <ZoruButton size="sm" variant="ghost" asChild>
                    <Link
                        href={`/dashboard/crm/inventory/production-orders/${orderId}/activity`}
                    >
                        <Activity className="h-3.5 w-3.5" /> Activity
                    </Link>
                </ZoruButton>
            </div>

            <ConfirmDialog
                open={archiveOpen}
                onOpenChange={setArchiveOpen}
                title={`Cancel order "${orderNo}"?`}
                description="Cancelled orders remain in the list with a red status pill. Yield records are preserved."
                confirmLabel="Cancel order"
                confirmTone="primary"
                onConfirm={onConfirmCancel}
            />
        </>
    );
}

export default PoDetailActions;
