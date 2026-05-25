'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function GrnError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('GRN page error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center space-y-4 rounded-md border border-dashed p-8 text-center animate-in fade-in-50">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-500" />
            </div>
            <div className="space-y-2">
                <h3 className="text-lg font-medium">Failed to load GRNs</h3>
                <p className="text-sm text-muted-foreground max-w-[500px]">
                    {error.message || 'An unexpected error occurred while fetching the Goods Receipt Notes.'}
                </p>
            </div>
            <Button onClick={reset} variant="outline" className="mt-4">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
            </Button>
        </div>
    );
}
