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
        console.error('WhatsApp Projects Admin page error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center space-y-4 rounded-xl border border-zoru-line bg-zoru-surface px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2">
                <AlertCircle className="h-6 w-6 text-zoru-ink" />
            </div>
            <div className="space-y-1">
                <h2 className="text-lg font-semibold text-zoru-ink">Something went wrong!</h2>
                <p className="text-sm text-zoru-ink-muted max-w-md mx-auto">
                    {error.message || 'An unexpected error occurred while loading the WhatsApp projects.'}
                </p>
            </div>
            <Button
                onClick={() => reset()}
                variant="outline"
                className="mt-4 border-zoru-line bg-zoru-bg text-zoru-ink hover:bg-zoru-surface"
            >
                Try again
            </Button>
        </div>
    );
}
