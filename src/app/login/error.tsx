'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function LoginErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="zoruui flex min-h-screen flex-col items-center justify-center p-6 text-center bg-[var(--st-bg)] text-[var(--st-text)]">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--st-text)]/10 text-[var(--st-text)] mb-6">
                <AlertTriangle className="h-10 w-10" />
            </div>
            <h2 className="mb-2 text-2xl font-bold tracking-tight">Login Error</h2>
            <p className="mb-6 max-w-md text-[var(--st-text-secondary)] text-sm">
                We encountered an unexpected error while trying to load the login page.
                Please try again or refresh the page. If the issue persists, contact support.
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
