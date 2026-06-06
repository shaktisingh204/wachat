'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('WhatsApp Projects Admin page error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center space-y-4 rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)]">
                <AlertCircle className="h-6 w-6 text-[var(--st-text)]" />
            </div>
            <div className="space-y-1">
                <h2 className="text-lg font-semibold text-[var(--st-text)]">Something went wrong!</h2>
                <p className="text-sm text-[var(--st-text-secondary)] max-w-md mx-auto">
                    {error.message || 'An unexpected error occurred while loading the WhatsApp projects.'}
                </p>
            </div>
            <Button
                onClick={() => reset()}
                variant="outline"
                className="mt-4 border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]"
            >
                Try again
            </Button>
        </div>
    );
}
