'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/zoruui';
import {
    submitSabworkerlyTimesheet,
    approveSabworkerlyTimesheet,
    rejectSabworkerlyTimesheet,
} from '@/app/actions/sabworkerly.actions';

export function TimesheetActions({ id, status }: { id: string; status: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    const handle = (fn: () => Promise<unknown>): void => {
        startTransition(async () => {
            await fn();
            router.refresh();
        });
    };

    return (
        <div className="flex gap-1">
            {(status === 'draft' || status === 'rejected') && (
                <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => handle(() => submitSabworkerlyTimesheet(id))}
                >
                    Submit
                </Button>
            )}
            {status === 'submitted' && (
                <>
                    <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => handle(() => approveSabworkerlyTimesheet(id))}
                    >
                        Approve
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                            const reason = window.prompt('Rejection reason?') ?? undefined;
                            handle(() => rejectSabworkerlyTimesheet(id, reason));
                        }}
                    >
                        Reject
                    </Button>
                </>
            )}
        </div>
    );
}
