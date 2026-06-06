'use client';

import { FallbackProps } from 'react-error-boundary';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function ChartsError({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center space-y-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-text)]/10">
                <AlertCircle className="h-6 w-6 text-[var(--st-text)]" />
            </div>
            <div className="space-y-2">
                <h2 className="text-lg font-semibold tracking-tight">Something went wrong</h2>
                <p className="text-sm text-[var(--st-text-secondary)]">
                    An error occurred while loading the chart of accounts.
                </p>
                {error?.message && (
                    <p className="text-xs text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)] p-2 rounded-md max-w-md mx-auto truncate">
                        {error.message}
                    </p>
                )}
            </div>
            <Button onClick={resetErrorBoundary} variant="outline">
                Try again
            </Button>
        </div>
    );
}
