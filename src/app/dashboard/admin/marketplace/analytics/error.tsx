'use client';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function AnalyticsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Marketplace Analytics Error:', error);
    }, [error]);

    return (
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 rounded-xl border border-[var(--st-border)] bg-[var(--st-text)] p-8 text-center text-white">
            <AlertCircle className="h-10 w-10 text-[var(--st-text)]" />
            <div className="space-y-2">
                <h2 className="text-xl font-semibold">Failed to load marketplace analytics</h2>
                <p className="text-sm text-[var(--st-text-secondary)]">
                    {error.message || 'An unexpected error occurred while fetching analytics data.'}
                </p>
            </div>
            <Button onClick={() => reset()} variant="outline" className="mt-4">
                Try again
            </Button>
        </div>
    );
}
