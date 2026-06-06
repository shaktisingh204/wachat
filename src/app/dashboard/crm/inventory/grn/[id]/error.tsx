'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function GrnDetailError({
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
        <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-[var(--st-border)] border-dashed p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                <AlertCircle className="h-6 w-6" />
            </div>
            <div className="max-w-md space-y-2">
                <h2 className="text-[15px] font-semibold text-[var(--st-text)]">
                    Something went wrong!
                </h2>
                <p className="text-[13px] text-[var(--st-text-secondary)]">
                    We encountered an error while trying to load the GRN details. Please try again.
                </p>
            </div>
            <Button onClick={() => reset()} variant="outline">
                Try again
            </Button>
        </div>
    );
}
