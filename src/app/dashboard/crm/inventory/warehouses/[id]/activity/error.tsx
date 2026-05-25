'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Warehouse activity error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-[var(--zoru-radius)] border border-dashed border-zoru-line p-8 text-center bg-zoru-surface-1">
            <h2 className="text-xl font-semibold text-zoru-ink">Failed to load activity</h2>
            <p className="text-sm text-zoru-ink-muted">
                {error.message || 'An unexpected error occurred while loading the warehouse activity.'}
            </p>
            <Button onClick={() => reset()} variant="outline">
                Try again
            </Button>
        </div>
    );
}
