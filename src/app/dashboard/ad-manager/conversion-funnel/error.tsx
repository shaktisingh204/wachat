'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

import { Alert, Button } from '@/components/sabcrm/20ui';

export default function ConversionFunnelError({
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
        <div className="space-y-4">
            <Alert tone="danger" title="Something went wrong">
                {error.message || 'Failed to load the conversion funnel data.'}
            </Alert>
            <Button variant="outline" iconLeft={RefreshCw} onClick={() => reset()}>
                Try again
            </Button>
        </div>
    );
}
