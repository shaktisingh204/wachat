'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';

export default function EditShiftRotationError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Edit shift rotation error:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-8 text-center">
            <h2 className="mb-2 text-xl font-semibold text-[var(--st-text)]">Something went wrong!</h2>
            <p className="mb-6 text-[14px] text-[var(--st-text-secondary)]">
                {error.message || 'Failed to load shift rotation data.'}
            </p>
            <Button onClick={() => reset()} variant="default">
                Try again
            </Button>
        </div>
    );
}
