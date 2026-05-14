'use client';

/**
 * Inline status mutation buttons for the GRN detail page —
 * Accept (status=posted) / Archive (status=rejected as a soft-archive
 * proxy). Lives next to Edit / Convert / Activity actions.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Archive, CheckCircle2, LoaderCircle } from 'lucide-react';

import { ZoruButton, useZoruToast } from '@/components/zoruui';
import { bulkGrnAction, setGrnStatus } from '@/app/actions/crm/grns.actions';

interface GrnDetailActionsProps {
    id: string;
    currentStatus: string;
}

export function GrnDetailActions({ id, currentStatus }: GrnDetailActionsProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [pending, startTransition] = React.useTransition();
    const [busy, setBusy] = React.useState<'accept' | 'archive' | null>(null);

    const run = (op: 'accept' | 'archive') => {
        setBusy(op);
        startTransition(async () => {
            if (op === 'archive') {
                // No first-class archive flag on the Rust DTO — set
                // status=rejected as the closest soft-archive proxy.
                const res = await bulkGrnAction([id], 'status', 'rejected');
                setBusy(null);
                if (res.success) {
                    toast({ title: 'GRN archived' });
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
            const res = await setGrnStatus(id, 'posted');
            setBusy(null);
            if (res.success) {
                toast({ title: 'GRN accepted' });
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

    const isLoading = (op: 'accept' | 'archive') => pending && busy === op;

    return (
        <>
            <ZoruButton
                variant="outline"
                onClick={() => run('accept')}
                disabled={pending || currentStatus === 'posted'}
            >
                {isLoading('accept') ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                    <CheckCircle2 className="h-4 w-4" />
                )}
                Accept
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
