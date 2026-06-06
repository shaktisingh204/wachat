'use client';

import { Button, useToast } from '@/components/sabcrm/20ui';
import { useTransition } from 'react';
import { Send } from 'lucide-react';

/**
 * Recovery-email dispatcher — small client island that calls
 * `dispatchRecoveryEmail` and shows a toast.
 *
 * The actual mail dispatch is stubbed in the action (see structured log).
 */

import { dispatchRecoveryEmail } from '@/app/actions/crm-store.actions';

export function RecoveryButton({ cartId }: { cartId: string }) {
    const { toast } = useToast();
    const [pending, startTransition] = useTransition();

    return (
        <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
                startTransition(async () => {
                    const res = await dispatchRecoveryEmail(cartId);
                    if (res.ok) {
                        toast({
                            title: 'Recovery email queued',
                            description: 'The mail worker will pick it up shortly.',
                        });
                    } else {
                        toast({
                            title: 'Error',
                            description: res.error,
                            variant: 'destructive',
                        });
                    }
                });
            }}
        >
            <Send className="h-3.5 w-3.5" />
            Send recovery email
        </Button>
    );
}
