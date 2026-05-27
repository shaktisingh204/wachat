'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Character Counter Page Error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-destructive/50 bg-zoru-ink/10 p-8 text-center">
            <div className="rounded-full bg-zoru-ink/20 p-4">
                <AlertCircle className="h-8 w-8 text-zoru-ink" />
            </div>
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight text-zoru-ink">
                    Something went wrong!
                </h2>
                <p className="text-sm text-zoru-ink-muted max-w-md mx-auto">
                    {error.message || "We encountered an unexpected error while loading the Character Counter tool. Please try again."}
                </p>
            </div>
            <div className="flex gap-4 mt-4">
                <Button onClick={() => reset()} variant="default">
                    Try again
                </Button>
                <Button onClick={() => window.location.reload()} variant="outline">
                    Reload Page
                </Button>
            </div>
        </div>
    );
}
