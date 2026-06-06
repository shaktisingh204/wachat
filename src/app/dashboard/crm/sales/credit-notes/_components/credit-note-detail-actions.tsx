'use client';

import { Button, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { Archive,
  BadgeDollarSign,
  LoaderCircle } from 'lucide-react';

/**
 * Inline status mutation buttons for the credit-note detail page —
 * Mark Refunded / Archive. Lives next to the Edit and Activity
 * actions in the header.
 */

import * as React from 'react';

import {
    bulkCreditNoteAction,
    setCreditNoteStatus,
} from '@/app/actions/crm/credit-notes.actions';

interface CreditNoteDetailActionsProps {
    id: string;
    currentStatus: string;
}

export function CreditNoteDetailActions({
    id,
    currentStatus,
}: CreditNoteDetailActionsProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [pending, startTransition] = React.useTransition();
    const [busy, setBusy] = React.useState<'refunded' | 'archive' | null>(null);

    const run = (op: 'refunded' | 'archive') => {
        setBusy(op);
        startTransition(async () => {
            if (op === 'archive') {
                const res = await bulkCreditNoteAction([id], 'archive');
                setBusy(null);
                if (res.success) {
                    toast({ title: 'Credit note archived' });
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
            const res = await setCreditNoteStatus(id, 'refunded');
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
            <Button
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
            </Button>
            <Button
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
            </Button>
        </>
    );
}
