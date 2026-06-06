'use client';

import { Button, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { Archive,
  CheckCircle2,
  LoaderCircle,
  XCircle } from 'lucide-react';

/**
 * Inline status mutation buttons for the payout detail page —
 * Mark Cleared / Mark Failed / Archive. Lives next to the Edit and
 * Activity actions.
 */

import * as React from 'react';

import {
    bulkPayoutAction,
    setPayoutStatus,
} from '@/app/actions/crm/payouts.actions';

interface PayoutDetailActionsProps {
    id: string;
    currentStatus: string;
}

export function PayoutDetailActions({ id, currentStatus }: PayoutDetailActionsProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, startTransition] = React.useTransition();
    const [busy, setBusy] = React.useState<'cleared' | 'failed' | 'archive' | null>(null);

    const run = (op: 'cleared' | 'failed' | 'archive') => {
        setBusy(op);
        startTransition(async () => {
            if (op === 'archive') {
                const res = await bulkPayoutAction([id], 'archive');
                setBusy(null);
                if (res.success) {
                    toast({ title: 'Payout archived' });
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
            const res = await setPayoutStatus(id, op);
            setBusy(null);
            if (res.success) {
                toast({ title: `Marked ${op}` });
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

    const isLoading = (op: 'cleared' | 'failed' | 'archive') => pending && busy === op;

    return (
        <>
            <Button
                variant="outline"
                onClick={() => run('cleared')}
                disabled={pending || currentStatus === 'cleared'}
            >
                {isLoading('cleared') ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                    <CheckCircle2 className="h-4 w-4" />
                )}
                Mark cleared
            </Button>
            <Button
                variant="outline"
                onClick={() => run('failed')}
                disabled={pending || currentStatus === 'failed'}
            >
                {isLoading('failed') ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                    <XCircle className="h-4 w-4" />
                )}
                Mark failed
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
