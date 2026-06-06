'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';

export default function IntegrationsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Integrations route error:', error);
    }, [error]);

    return (
        <div className="flex w-full flex-1 flex-col items-center justify-center p-8">
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 w-full">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] mb-4">
                    <AlertCircle className="h-6 w-6 text-[var(--st-text)]" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--st-text)] mb-2">Something went wrong</h3>
                <p className="text-sm text-[var(--st-text)] max-w-md mx-auto mb-6">
                    {error.message || 'There was an error loading the integrations. Please try again.'}
                </p>
                <Button onClick={() => reset()} variant="default" className="rounded-full">
                    Try again
                </Button>
            </div>
        </div>
    );
}
