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
        console.error('Contact detail page error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] p-8 text-center bg-[var(--st-bg-secondary)]">
            <h2 className="text-xl font-semibold text-[var(--st-text)]">Something went wrong!</h2>
            <p className="text-sm text-[var(--st-text-secondary)]">
                {error.message || 'An unexpected error occurred while loading the contact details.'}
            </p>
            <Button onClick={() => reset()} variant="outline">
                Try again
            </Button>
        </div>
    );
}
