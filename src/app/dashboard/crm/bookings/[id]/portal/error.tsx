'use client';

import * as React from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function BookingPortalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    React.useEffect(() => {
        console.error('Booking portal route error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-md border border-[var(--st-border)] border-dashed bg-[var(--st-hover)] p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/30">
                <AlertCircle className="h-6 w-6 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]" />
            </div>
            <div className="space-y-1">
                <h3 className="text-lg font-medium text-[var(--st-text)]">Something went wrong!</h3>
                <p className="max-w-[400px] text-sm text-[var(--st-text-secondary)]">
                    {error.message || 'An unexpected error occurred while loading booking portal data. Please try again.'}
                </p>
            </div>
            <Button onClick={reset} variant="outline" className="mt-2">
                <RefreshCw className="mr-2 h-4 w-4" /> Try again
            </Button>
        </div>
    );
}
