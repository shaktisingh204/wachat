'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';

export default function BuilderError({
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
        <div className="flex h-screen w-full flex-col items-center justify-center space-y-4 p-8">
            <h2 className="text-xl font-semibold text-[var(--st-text)]">Something went wrong!</h2>
            <p className="text-sm text-[var(--st-text-secondary)]">{error.message || 'Failed to load website builder.'}</p>
            <Button onClick={() => reset()} variant="default">
                Try again
            </Button>
        </div>
    );
}
