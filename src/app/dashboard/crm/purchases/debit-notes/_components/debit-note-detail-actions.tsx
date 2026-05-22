'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { Archive,
  BadgeDollarSign,
  LoaderCircle } from 'lucide-react';

/**
 * Inline status mutation buttons for the debit-note detail page —
 * Mark Refunded / Archive. Lives next to Edit and Activity actions.
 */

import * as React from 'react';

import {
    bulkDebitNoteAction,
    setDebitNoteStatus,
} from '@/app/actions/crm/debit-notes.actions';

interface DebitNoteDetailActionsProps {
    id: string;
    currentStatus: string;
}

export function DebitNoteDetailActions({
    id,
    currentStatus,
}: DebitNoteDetailActionsProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [pending, startTransition] = React.useTransition();
    const [busy, setBusy] = React.useState<'refunded' | 'archive' | null>(null);

    const run = (op: 'refunded' | 'archive') => {
        setBusy(op);
        startTransition(async () => {
            if (op === 'archive') {
                const res = await bulkDebitNoteAction([id], 'archive');
                setBusy(null);
                if (res.success) {
                    toast({ title: 'Debit note archived' });
                    router.refresh();
                } else {
                    toast({
                        title: 'Archive failed',
                        description: res.error,
                        variant: 'destructive',
                    });
                }
                return;
            }
            const res = await setDebitNoteStatus(id, 'refunded');
            setBusy(null);
            if (res.success) {
                toast({ title: 'Marked refunded' });
                router.refresh();
            } else {
                toast({
                    title: 'Update failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const isLoading = (op: 'refunded' | 'archive') => pending && busy === op;

    return (
        <>
            <ZoruButton
                variant="outline"
                onClick={() => run('refunded')}
                disabled={pending || currentStatus === 'refunded'}
            >
                {isLoading('refunded') ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                    <BadgeDollarSign className="h-4 w-4" />
                )}
                Mark refunded
            </ZoruButton>
            <ZoruButton
                variant="outline"
                onClick={() => run('archive')}
                disabled={pending}
            >
                {isLoading('archive') ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                    <Archive className="h-4 w-4" />
                )}
                Archive
            </ZoruButton>
        </>
    );
}
