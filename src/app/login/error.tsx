'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';

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
        <div className="20ui flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--st-bg)] text-[var(--st-text)]">
            <EmptyState
                icon={AlertTriangle}
                tone="danger"
                title="Login error"
                description="We encountered an unexpected error while trying to load the login page. Please try again or refresh the page. If the issue persists, contact support."
                action={
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Button variant="primary" iconLeft={RotateCcw} onClick={() => reset()}>
                            Try again
                        </Button>
                        <Button
                            variant="outline"
                            iconLeft={RefreshCw}
                            onClick={() => window.location.reload()}
                        >
                            Refresh page
                        </Button>
                    </div>
                }
            />
        </div>
    );
}
