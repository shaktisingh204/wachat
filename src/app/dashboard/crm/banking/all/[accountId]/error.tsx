'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Payment Account Detail error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] border-dashed p-8 text-center bg-[var(--st-bg-secondary)]/50">
            <h2 className="text-lg font-semibold text-[var(--st-text)]">Something went wrong</h2>
            <p className="text-[13px] text-[var(--st-text-secondary)] max-w-[400px]">
                {error.message || 'An unexpected error occurred while loading the payment account data.'}
            </p>
            <Button onClick={() => reset()} variant="outline" className="mt-2 h-9">
                Try again
            </Button>
        </div>
    );
}
