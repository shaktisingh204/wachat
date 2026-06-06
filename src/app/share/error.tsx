'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function ShareErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Share layout error:', error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-zoru-surface-2 antialiased">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink mb-6">
                <AlertTriangle className="h-10 w-10" />
            </div>
            <h2 className="mb-2 text-2xl font-bold tracking-tight text-zoru-ink">Something went wrong</h2>
            <p className="mb-6 max-w-md text-sm text-zoru-ink">
                We encountered an unexpected error while trying to load this shared page.
                Please try again or refresh the page.
            </p>
            <div className="flex gap-4">
                <Button onClick={() => reset()} variant="default">
                    Try again
                </Button>
                <Button onClick={() => window.location.reload()} variant="outline">
                    Refresh page
                </Button>
            </div>
        </div>
    );
}
