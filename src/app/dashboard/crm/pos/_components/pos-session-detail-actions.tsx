'use client';

import { ZoruButton, zoruSonnerToast } from '@/components/zoruui';
import { useRouter } from 'next/navigation';

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

    const onClose = async () => {
        const raw = window.prompt('Closing cash counted (₹)?');
        if (raw == null) return;
        const closingCash = Number(raw);
        if (!Number.isFinite(closingCash) || closingCash < 0) {
            zoruSonnerToast.error(
                'Closing cash must be a non-negative number.',
            );
            return;
        }
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
                <ZoruButton
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={onClose}
                >
                    Close session
                </ZoruButton>
            ) : null}
            {status === 'closed' ? (
                <ZoruButton size="sm" disabled={pending} onClick={onReconcile}>
                    Reconcile
                </ZoruButton>
            ) : null}
            {(status === 'closed' || status === 'reconciled') ? (
                <ZoruButton
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={onArchive}
                >
                    Archive
                </ZoruButton>
            ) : null}
        </div>
    );
}
