'use client';

import { Button } from '@/components/zoruui';
import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';

/**
 * Tiny client island for the "Re-run" CTA on the run viewer.
 * Calls the `runReportById` server action and refreshes to the new
 * run id on success.
 */

import { runReportById } from '@/app/actions/crm-reports.actions';

export function RerunButton({ definitionId }: { definitionId: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const onClick = () => {
        setError(null);
        startTransition(async () => {
            const res = await runReportById(definitionId);
            if (res.error || !res.runId) {
                setError(res.error ?? 'Failed to run.');
                return;
            }
            router.push(`/dashboard/sabbi/reports/${definitionId}/runs/${res.runId}`);
            router.refresh();
        });
    };

    return (
        <div className="flex items-center gap-2">
            {error && (
                <span className="text-xs text-destructive" role="alert">
                    {error}
                </span>
            )}
            <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={onClick}
                disabled={pending}
            >
                {pending ? 'Running…' : 'Re-run'}
            </Button>
        </div>
    );
}
