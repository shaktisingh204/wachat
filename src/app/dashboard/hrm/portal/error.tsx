'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
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
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center bg-zoru-surface-1 rounded-xl border border-zoru-line">
            <div className="h-12 w-12 rounded-full bg-zoru-surface-2/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-zoru-ink" />
            </div>
            <div className="space-y-1">
                <h2 className="text-[15px] font-semibold text-zoru-ink">Failed to load portal data</h2>
                <p className="text-[13px] text-zoru-ink-muted max-w-md">
                    {error.message || 'An unexpected error occurred while fetching your portal information. Please try again.'}
                </p>
            </div>
            <Button onClick={() => reset()} variant="outline" size="sm">
                Try again
            </Button>
        </div>
    );
}
