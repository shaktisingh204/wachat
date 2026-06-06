'use client';
import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function ShopError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Shop Error:", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                <AlertCircle className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-sm text-[var(--st-text-secondary)] max-w-md">
                We encountered an error loading this shop page. Please try again.
            </p>
            <Button onClick={() => reset()}>Try again</Button>
        </div>
    );
}
