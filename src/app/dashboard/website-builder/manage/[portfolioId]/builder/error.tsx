'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error("Builder Error:", error);
    }, [error]);

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center p-8 text-center bg-[var(--st-bg-secondary)] dark:bg-[var(--st-text)]">
            <h2 className="text-2xl font-bold mb-4 text-[var(--st-text)]">Something went wrong!</h2>
            <p className="text-[var(--st-text-secondary)] mb-8 max-w-md">
                We encountered an error loading the website builder or its resources. Please try again or return to the dashboard if the issue persists.
            </p>
            <div className="flex gap-4">
                <Button onClick={() => reset()}>Try again</Button>
                <Button variant="outline" onClick={() => window.location.href = '/dashboard/website-builder'}>
                    Back to Dashboard
                </Button>
            </div>
        </div>
    );
}
