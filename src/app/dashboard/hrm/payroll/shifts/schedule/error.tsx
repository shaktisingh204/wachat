'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function ScheduleError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Shift schedule error:', error);
    }, [error]);

    return (
        <EntityListShell title="Shift Schedule">
            <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-6 text-center">
                <AlertCircle className="h-10 w-10 text-[var(--st-text)]" />
                <h2 className="text-lg font-semibold text-[var(--st-text)]">Something went wrong</h2>
                <p className="text-sm text-[var(--st-text-secondary)]">
                    {error.message || 'Failed to load shift schedule data.'}
                </p>
                <Button onClick={() => reset()} variant="default">
                    Try again
                </Button>
            </div>
        </EntityListShell>
    );
}
