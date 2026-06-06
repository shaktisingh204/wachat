'use client';

import { Button, useToast } from '@/components/sabcrm/20ui';
import {
  useRouter } from 'next/navigation';
import { Archive,
  CheckCircle2,
  LoaderCircle,
  XCircle } from 'lucide-react';

/**
 * Inline status mutation buttons for the receipt detail page —
 * Mark Cleared / Mark Bounced / Archive. Lives next to the Edit and
 * Activity actions.
 */

import * as React from 'react';

import {
    bulkPaymentReceiptAction,
    setPaymentReceiptStatus,
} from '@/app/actions/crm/payment-receipts.actions';

interface ReceiptDetailActionsProps {
    id: string;
    currentStatus: string;
}

export function ReceiptDetailActions({ id, currentStatus }: ReceiptDetailActionsProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, startTransition] = React.useTransition();
    const [busy, setBusy] = React.useState<'cleared' | 'bounced' | 'archive' | null>(null);

    const run = (op: 'cleared' | 'bounced' | 'archive') => {
        setBusy(op);
        startTransition(async () => {
            if (op === 'archive') {
                const res = await bulkPaymentReceiptAction([id], 'archive');
                setBusy(null);
                if (res.success) {
                    toast({ title: 'Receipt archived' });
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
            const res = await setPaymentReceiptStatus(id, op);
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

    const isLoading = (op: 'cleared' | 'bounced' | 'archive') => pending && busy === op;

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
                onClick={() => run('bounced')}
                disabled={pending || currentStatus === 'bounced'}
            >
                {isLoading('bounced') ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                    <XCircle className="h-4 w-4" />
                )}
                Mark bounced
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
