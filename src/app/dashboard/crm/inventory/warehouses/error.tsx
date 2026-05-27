'use client';

import * as React from 'react';
import { Button } from '@/components/zoruui';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function WarehousesError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    React.useEffect(() => {
        // Log the error to an error reporting service if available
        console.error('Warehouses route error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-md border border-zoru-line border-dashed bg-zoru-surface-hover p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 dark:bg-zoru-ink/30">
                <AlertCircle className="h-6 w-6 text-zoru-ink dark:text-zoru-ink-muted" />
            </div>
            <div className="space-y-1">
                <h3 className="text-lg font-medium text-zoru-ink">Something went wrong!</h3>
                <p className="max-w-[400px] text-sm text-zoru-ink-muted">
                    {error.message || 'An unexpected error occurred while loading warehouses data. Please try again.'}
                </p>
            </div>
            <Button onClick={reset} variant="outline" className="mt-2">
                <RefreshCw className="mr-2 h-4 w-4" /> Try again
            </Button>
        </div>
    );
}
