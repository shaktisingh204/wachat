'use client';

import { useEffect } from 'react';
import { Button, Alert } from '@/components/sabcrm/20ui';
import { RefreshCw } from 'lucide-react';

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
        <div className="flex flex-col items-start gap-4 p-6">
            <Alert tone="danger" title="Something went wrong">
                {error.message || 'Failed to load campaign data. The Meta API might be unavailable.'}
            </Alert>
            <Button variant="outline" iconLeft={RefreshCw} onClick={() => reset()}>
                Try again
            </Button>
        </div>
    );
}
