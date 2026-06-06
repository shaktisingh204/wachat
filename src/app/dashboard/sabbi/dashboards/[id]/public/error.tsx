'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function PublicDashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Public Dashboard Error Boundary caught an error:', error);
    }, [error]);

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center space-y-4 text-center bg-[var(--st-bg-secondary)] p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-danger-surface text-[var(--st-danger)]">
                <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-2">
                <h2 className="text-lg font-semibold tracking-tight text-[var(--st-text)]">Dashboard Error</h2>
                <p className="text-sm text-[var(--st-text-secondary)]">
                    An error occurred while loading this public dashboard.
                </p>
                {error?.message && (
                    <p className="text-xs text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)] p-2 rounded-md max-w-md mx-auto truncate border border-[var(--st-border)]">
                        {error.message}
                    </p>
                )}
            </div>
            <Button onClick={() => reset()} variant="outline" className="mt-4">
                Try again
            </Button>
        </div>
    );
}
