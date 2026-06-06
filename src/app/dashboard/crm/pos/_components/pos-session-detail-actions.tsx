'use client';

import { Button, zoruSonnerToast } from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';
import { Printer } from 'lucide-react';

/**
 * Client island for the POS session detail page — Close / Reconcile /
 * Archive buttons. Reads the live status and renders only the
 * actions that make sense for the current state.
 */

import * as React from 'react';

import {
    closePosSession,
    reconcilePosSession,
    archivePosSession,
    type PosSessionStatus,
} from '@/app/actions/crm-pos.actions';
import { PosCashCounterDialog } from './pos-cash-counter-dialog';

interface Props {
    sessionId: string;
    status: PosSessionStatus;
}

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

export function PosSessionDetailActions({ sessionId, status }: Props) {
    const router = useRouter();
    const [pending, setPending] = React.useState(false);

    const [showCounter, setShowCounter] = React.useState(false);

    const onClose = () => {
        setShowCounter(true);
    };

    const handleConfirmClose = async (closingCash: number) => {
        setShowCounter(false);
        setPending(true);
        try {
            const res = await closePosSession({ id: sessionId, closingCash });
            if (res.success) {
                zoruSonnerToast.success(
                    `Session closed. Discrepancy: ${inr.format(res.discrepancy ?? 0)}.`,
                );
                router.refresh();
            } else {
                zoruSonnerToast.error(res.error ?? 'Failed to close.');
            }
        } finally {
            setPending(false);
        }
    };

    const onReconcile = async () => {
        setPending(true);
        try {
            const res = await reconcilePosSession(sessionId);
            if (res.success) {
                zoruSonnerToast.success('Session reconciled.');
                router.refresh();
            } else {
                zoruSonnerToast.error(res.error ?? 'Failed to reconcile.');
            }
        } finally {
            setPending(false);
        }
    };

    const onArchive = async () => {
        if (!window.confirm('Archive this session? It will no longer appear in active lists.')) {
            return;
        }
        setPending(true);
        try {
            const res = await archivePosSession(sessionId);
            if (res.success) {
                zoruSonnerToast.success('Session archived.');
                router.push('/dashboard/crm/pos/sessions');
            } else {
                zoruSonnerToast.error(res.error ?? 'Failed to archive.');
            }
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="flex gap-2">
            {status === 'open' ? (
                <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={onClose}
                >
                    Close session
                </Button>
            ) : null}
            {status === 'closed' ? (
                <Button size="sm" disabled={pending} onClick={onReconcile}>
                    Reconcile
                </Button>
            ) : null}
            {(status === 'closed' || status === 'reconciled') ? (
                <Button size="sm" variant="outline" onClick={() => window.print()}>
                    <Printer className="mr-1 h-3.5 w-3.5" /> Z-Report
                </Button>
            ) : null}
            {(status === 'closed' || status === 'reconciled') ? (
                <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={onArchive}
                >
                    Archive
                </Button>
            ) : null}
            
            <PosCashCounterDialog 
                open={showCounter} 
                onOpenChange={setShowCounter} 
                onConfirm={handleConfirmClose} 
            />
        </div>
    );
}
