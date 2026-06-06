'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function ChartOfAccountDetailError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('ChartOfAccount Detail Error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-xl font-semibold">Something went wrong!</h2>
            <p className="text-sm text-zoru-ink-muted">
                We couldn't load the chart of account details.
            </p>
            <Button onClick={() => reset()} variant="outline">
                Try again
            </Button>
        </div>
    );
}
