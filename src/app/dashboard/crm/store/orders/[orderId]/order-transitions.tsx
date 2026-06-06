'use client';

import { Button, useToast } from '@/components/sabcrm/20ui';
import {
  useTransition } from 'react';
import {
    CheckCircle2,
  PackageCheck,
  XCircle,
  } from 'lucide-react';

/**
 * Order transition buttons — client island. Wraps each transition
 * action in a `useTransition` + toast pair. The "Mark paid" path also
 * surfaces the TODO that auto-invoice creation is still pending.
 */

import {
    cancelOrder,
    markOrderFulfilled,
    markOrderPaid,
} from '@/app/actions/crm-store.actions';

export function OrderTransitions({
    orderId,
    status,
}: {
    orderId: string;
    status: string;
}) {
    const { toast } = useToast();
    const [pending, startTransition] = useTransition();

    const lower = status.toLowerCase();
    const canMarkPaid = lower !== 'paid' && lower !== 'cancelled' && lower !== 'refunded';
    const canFulfill = lower !== 'fulfilled' && lower !== 'cancelled';
    const canCancel = lower !== 'cancelled' && lower !== 'refunded';

    function run(
        label: string,
        thunk: () => Promise<{ ok: true } | { ok: false; error: string }>,
    ) {
        startTransition(async () => {
            const res = await thunk();
            if (res.ok) {
                toast({ title: label, description: 'Status updated.' });
            } else {
                toast({
                    title: 'Error',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            {canMarkPaid ? (
                <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                        run('Order marked paid', () => markOrderPaid(orderId))
                    }
                >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mark paid
                </Button>
            ) : null}
            {canFulfill ? (
                <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                        run('Order fulfilled', () =>
                            markOrderFulfilled(orderId),
                        )
                    }
                >
                    <PackageCheck className="h-3.5 w-3.5" />
                    Mark fulfilled
                </Button>
            ) : null}
            {canCancel ? (
                <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                        run('Order cancelled', () => cancelOrder(orderId))
                    }
                >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel
                </Button>
            ) : null}
        </div>
    );
}
