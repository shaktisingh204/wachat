'use client';
import { useEffect } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <EntityListShell title="TDS 194Q Error" subtitle="There was a problem loading the TDS 194Q tracker.">
            <div className="flex h-[300px] flex-col items-center justify-center gap-4 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <p className="text-[14px] text-[var(--st-text-secondary)]">{error.message || 'An error occurred during data load or computation.'}</p>
                <button
                    onClick={() => reset()}
                    className="rounded-md bg-[var(--st-text)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
                >
                    Try again
                </button>
            </div>
        </EntityListShell>
    );
}
