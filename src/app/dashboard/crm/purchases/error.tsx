'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function PurchasesError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Purchases module error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center">
            <h2 className="text-xl font-semibold text-[var(--st-text)]">Something went wrong!</h2>
            <p className="text-sm text-[var(--st-text-secondary)]">
                {error.message || 'An unexpected error occurred in the Purchases module.'}
            </p>
            <Button onClick={() => reset()} variant="outline">
                Try again
            </Button>
        </div>
    );
}
