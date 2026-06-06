'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function OnboardingError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Onboarding API Error:', error);
    }, [error]);

    return (
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 rounded-xl border bg-zoru-surface p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold tracking-tight">Something went wrong!</h2>
            <p className="text-zoru-ink-muted max-w-[500px]">
                We encountered an error while trying to load your onboarding data. Please try again.
            </p>
            <Button onClick={() => reset()} variant="default">
                Try again
            </Button>
        </div>
    );
}
