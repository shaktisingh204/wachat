'use client';
import { Button } from '@/components/zoruui';
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
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 rounded-xl border border-zoru-line bg-zoru-ink p-8 text-center text-white">
            <AlertCircle className="h-10 w-10 text-zoru-ink" />
            <div className="space-y-2">
                <h2 className="text-xl font-semibold">Failed to load marketplace analytics</h2>
                <p className="text-sm text-zoru-ink-muted">
                    {error.message || 'An unexpected error occurred while fetching analytics data.'}
                </p>
            </div>
            <Button onClick={() => reset()} variant="outline" className="mt-4">
                Try again
            </Button>
        </div>
    );
}
