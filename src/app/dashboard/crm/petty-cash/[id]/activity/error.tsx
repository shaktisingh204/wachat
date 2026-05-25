'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/zoruui/button';

export default function PettyCashActivityError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Petty Cash Activity Error:', error);
    }, [error]);

    return (
        <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-8 text-center animate-in fade-in-50">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
                <h3 className="text-lg font-semibold tracking-tight">Activity Error</h3>
                <p className="text-sm text-muted-foreground max-w-[400px]">
                    {error.message || 'We encountered a problem loading the petty cash activity.'}
                </p>
            </div>
            <Button
                variant="outline"
                onClick={reset}
                className="mt-4 gap-2"
            >
                <RefreshCcw className="h-4 w-4" />
                Try again
            </Button>
        </div>
    );
}
