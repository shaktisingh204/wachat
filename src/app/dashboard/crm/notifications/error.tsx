'use client';

import { useEffect } from 'react';
import { Card } from '@/components/zoruui';

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
                <h1 className="mb-2 text-base font-semibold text-zoru-ink">Something went wrong!</h1>
                <p className="text-sm text-zoru-ink-muted mb-4">{error.message || 'Failed to load notifications.'}</p>
                <button
                    onClick={reset}
                    className="rounded-md bg-zoru-blue px-4 py-2 text-sm font-medium text-white hover:bg-zoru-ink focus:outline-none focus:ring-2 focus:ring-zoru-line focus:ring-offset-2"
                >
                    Try again
                </button>
            </Card>
        </div>
    );
}
