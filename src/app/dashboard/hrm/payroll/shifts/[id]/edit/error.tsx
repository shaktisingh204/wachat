'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function EditShiftError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Data fetching error in Edit Shift:', error);
    }, [error]);

    return (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-lg font-semibold text-zoru-ink">
                Something went wrong loading this shift.
            </h2>
            <p className="text-sm text-zoru-ink-muted">
                {error.message || 'An unexpected error occurred during data fetching.'}
            </p>
            <Button variant="outline" onClick={() => reset()}>
                Try again
            </Button>
        </div>
    );
}
