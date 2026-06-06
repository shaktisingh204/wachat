'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';

export default function NewReconciliationError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex h-[400px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-8 text-center animate-in fade-in-50">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-text)]/10 text-[var(--st-text)]">
                <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-2 max-w-[420px]">
                <h3 className="text-lg font-medium">Failed to load</h3>
                <p className="text-sm text-[var(--st-text-secondary)]">
                    An error occurred while loading the new reconciliation form. Please try again.
                </p>
            </div>
            <Button variant="outline" onClick={() => reset()}>
                Try again
            </Button>
        </div>
    );
}
