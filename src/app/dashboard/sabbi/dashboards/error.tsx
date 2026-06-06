'use client';

import { Button } from '@/components/sabcrm/20ui';
import { Card } from '@/components/sabcrm/20ui';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { useEffect } from 'react';

export default function DashboardsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Dashboards module error:', error);
    }, [error]);

    return (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 sm:p-8">
            <Card className="flex max-w-md flex-col items-center p-8 text-center shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)]/50 text-[var(--st-text)] mb-4">
                    <AlertCircle className="h-6 w-6" />
                </div>
                <h2 className="mb-2 text-xl font-semibold text-[var(--st-text)]">
                    Failed to load Dashboards
                </h2>
                <p className="mb-6 text-sm text-[var(--st-text-secondary)]">
                    {error.message || 'An unexpected error occurred while loading this module.'}
                </p>
                <div className="flex gap-3">
                    <Button
                        variant="primary"
                        onClick={() => reset()}
                        className="flex items-center gap-2"
                    >
                        <RefreshCcw className="h-4 w-4" />
                        Try again
                    </Button>
                </div>
            </Card>
        </div>
    );
}
