'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
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
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl border border-dashed border-zoru-line bg-zoru-surface-2/50 w-full">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 mb-4">
                    <AlertCircle className="h-6 w-6 text-zoru-ink" />
                </div>
                <h3 className="text-lg font-semibold text-zoru-ink mb-2">Something went wrong</h3>
                <p className="text-sm text-zoru-ink max-w-md mx-auto mb-6">
                    {error.message || 'There was an error loading the integrations. Please try again.'}
                </p>
                <Button onClick={() => reset()} variant="default" className="rounded-full">
                    Try again
                </Button>
            </div>
        </div>
    );
}
