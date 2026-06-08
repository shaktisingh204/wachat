'use client';

import { useEffect } from 'react';
import { EmptyState, Button } from '@/components/sabcrm/20ui';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

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
        <div className="flex min-h-[400px] items-center justify-center">
            <EmptyState
                icon={AlertTriangle}
                title="Something went wrong"
                description={error.message || 'An unexpected error occurred while loading this page.'}
                action={
                    <Button onClick={() => reset()} variant="outline">
                        <RefreshCcw size={16} aria-hidden="true" />
                        Try again
                    </Button>
                }
            />
        </div>
    );
}
