'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Shifts page error:', error);
    }, [error]);

    return (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="mb-4 h-10 w-10 text-[var(--st-text)]" />
            <h2 className="mb-2 text-lg font-semibold text-[var(--st-text)]">Something went wrong</h2>
            <p className="mb-6 text-sm text-[var(--st-text-secondary)]">
                {error.message || 'Failed to load shifts data.'}
            </p>
            <Button onClick={() => reset()} variant="default">
                Try again
            </Button>
        </div>
    );
}
