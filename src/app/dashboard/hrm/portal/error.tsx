'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function PortalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Portal Error:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center bg-[var(--st-bg-secondary)] rounded-xl border border-[var(--st-border)]">
            <div className="h-12 w-12 rounded-full bg-[var(--st-bg-muted)]/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-[var(--st-text)]" />
            </div>
            <div className="space-y-1">
                <h2 className="text-[15px] font-semibold text-[var(--st-text)]">Failed to load portal data</h2>
                <p className="text-[13px] text-[var(--st-text-secondary)] max-w-md">
                    {error.message || 'An unexpected error occurred while fetching your portal information. Please try again.'}
                </p>
            </div>
            <Button onClick={() => reset()} variant="outline" size="sm">
                Try again
            </Button>
        </div>
    );
}
