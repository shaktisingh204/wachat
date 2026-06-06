'use client';

import { useEffect } from 'react';
import { Card } from '@/components/sabcrm/20ui/compat';

export default function NotificationsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Notifications error:', error);
    }, [error]);

    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <Card className="p-6">
                <h1 className="mb-2 text-base font-semibold text-[var(--st-text)]">Something went wrong!</h1>
                <p className="text-sm text-[var(--st-text-secondary)] mb-4">{error.message || 'Failed to load notifications.'}</p>
                <button
                    onClick={reset}
                    className="rounded-md bg-[var(--st-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--st-text)] focus:outline-none focus:ring-2 focus:ring-[var(--st-border)] focus:ring-offset-2"
                >
                    Try again
                </button>
            </Card>
        </div>
    );
}
