'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui/button';
import { EmptyState } from '@/components/zoruui/empty-state';
import { AlertTriangle } from 'lucide-react';

export default function BankingErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Banking module error:', error);
    }, [error]);

    return (
        <div className="flex h-[60vh] w-full items-center justify-center p-6">
            <EmptyState
                icon={<AlertTriangle className="text-zoru-danger-ink" />}
                title="Failed to load banking data"
                description={error.message || 'An unexpected error occurred while loading banking data. Please try again.'}
                action={
                    <Button onClick={() => reset()} variant="default">
                        Try again
                    </Button>
                }
            />
        </div>
    );
}
