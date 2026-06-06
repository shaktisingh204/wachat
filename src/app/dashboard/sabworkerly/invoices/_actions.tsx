'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/sabcrm/20ui';
import { updateSabworkerlyInvoiceStatus } from '@/app/actions/sabworkerly.actions';

export function InvoiceStatusActions({ id, status }: { id: string; status: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    const set = (next: 'sent' | 'paid' | 'overdue'): void => {
        startTransition(async () => {
            await updateSabworkerlyInvoiceStatus(id, next);
            router.refresh();
        });
    };

    return (
        <div className="flex gap-1">
            {status === 'draft' && (
                <Button size="sm" disabled={pending} onClick={() => set('sent')}>
                    Mark sent
                </Button>
            )}
            {(status === 'sent' || status === 'overdue') && (
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => set('paid')}>
                    Mark paid
                </Button>
            )}
            {status === 'sent' && (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => set('overdue')}>
                    Overdue
                </Button>
            )}
        </div>
    );
}
