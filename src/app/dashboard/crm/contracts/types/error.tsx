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
        console.error('Contract Types module error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-[var(--zoru-radius-lg)] border border-zoru-line border-dashed p-8 text-center bg-zoru-bg">
            <h2 className="text-lg font-semibold text-zoru-ink">Something went wrong</h2>
            <p className="text-[13px] text-zoru-ink-muted max-w-[400px]">
                {error.message || 'An unexpected error occurred while loading the contract types.'}
            </p>
            <Button onClick={() => reset()} variant="outline" className="mt-2 h-9">
                Try again
            </Button>
        </div>
    );
}
