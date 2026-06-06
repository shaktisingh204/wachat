'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function ShopSubPageError({
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
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
            <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
            <p className="text-[var(--st-text-secondary)] mb-6">We couldn't load this page. Please try again later.</p>
            <Button onClick={() => reset()} variant="default">
                Try again
            </Button>
        </div>
    );
}
