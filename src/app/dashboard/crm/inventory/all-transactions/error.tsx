'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';

export default function AllTransactionsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('AllTransactionsError:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center rounded-md border border-dashed p-8 text-center animate-in fade-in-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--st-text)]/10">
                <AlertCircle className="h-5 w-5 text-[var(--st-text)]" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Something went wrong!</h2>
            <p className="mt-2 text-sm text-[var(--st-text-secondary)] max-w-md">
                We encountered an error loading the transaction data. Please try again or contact support if the issue persists.
            </p>
            <div className="mt-6 flex items-center gap-4">
                <Button variant="outline" onClick={() => window.history.back()}>
                    Go back
                </Button>
                <Button onClick={() => reset()}>Try again</Button>
            </div>
        </div>
    );
}
