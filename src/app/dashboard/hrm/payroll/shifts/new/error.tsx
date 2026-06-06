'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
            <AlertCircle className="h-10 w-10 text-zoru-ink" />
            <div className="text-center">
                <h2 className="text-lg font-semibold">Something went wrong!</h2>
                <p className="text-sm text-zoru-ink-muted">Failed to load or save shift drafts.</p>
            </div>
            <Button onClick={() => reset()} variant="outline">
                Try again
            </Button>
        </div>
    );
}
