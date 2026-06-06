'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function EditTdsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Edit TDS Page Error:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl shadow-sm border border-zoru-line min-h-[400px]">
            <div className="h-12 w-12 rounded-full bg-zoru-surface-2 flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-zoru-ink" />
            </div>
            <h2 className="text-xl font-semibold text-zoru-ink mb-2">
                Failed to load TDS details
            </h2>
            <p className="text-sm text-zoru-ink max-w-md mb-6">
                {error.message || 'There was a problem fetching the TDS record. Please try again later.'}
            </p>
            <div className="flex items-center gap-3">
                <Button 
                    onClick={() => reset()} 
                    variant="default"
                    className="gap-2"
                >
                    <RefreshCw className="h-4 w-4" />
                    Try again
                </Button>
                <Button 
                    onClick={() => window.history.back()} 
                    variant="outline"
                >
                    Go back
                </Button>
            </div>
        </div>
    );
}
