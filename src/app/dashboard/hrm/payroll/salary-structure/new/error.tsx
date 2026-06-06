'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Error in new salary structure page:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-zoru-surface-1 rounded-[var(--zoru-radius)] border border-zoru-line">
            <div className="w-12 h-12 mb-4 text-zoru-error rounded-full bg-zoru-error/10 flex items-center justify-center">
                <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
            </div>
            <h2 className="text-lg font-medium text-zoru-ink mb-2">
                Something went wrong!
            </h2>
            <p className="text-[13px] text-zoru-ink-muted mb-6 max-w-md">
                {error.message || 'An unexpected error occurred while loading the new salary structure page.'}
            </p>
            <div className="flex gap-4">
                <Button onClick={() => window.history.back()} variant="outline">
                    Go Back
                </Button>
                <Button onClick={() => reset()}>
                    Try again
                </Button>
            </div>
        </div>
    );
}
