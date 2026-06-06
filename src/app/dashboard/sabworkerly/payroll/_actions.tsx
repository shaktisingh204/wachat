'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/sabcrm/20ui';
import { updateSabworkerlyPayrollRunStatus } from '@/app/actions/sabworkerly.actions';

export function PayrollRunActions({ id, status }: { id: string; status: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    const set = (next: 'approved' | 'paid'): void => {
        startTransition(async () => {
            await updateSabworkerlyPayrollRunStatus(id, next);
            router.refresh();
        });
    };

    return (
        <div className="flex gap-1">
            {status === 'draft' && (
                <Button size="sm" loading={pending} onClick={() => set('approved')}>
                    Approve
                </Button>
            )}
            {status === 'approved' && (
                <Button size="sm" variant="secondary" loading={pending} onClick={() => set('paid')}>
                    Mark paid
                </Button>
            )}
        </div>
    );
}
