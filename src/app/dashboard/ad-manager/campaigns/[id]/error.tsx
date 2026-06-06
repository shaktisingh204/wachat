'use client';
import { useEffect } from 'react';
import { Button, Alert, AlertTitle, AlertDescription } from '@/components/sabcrm/20ui/compat';
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
        <div className="p-6 flex flex-col items-start gap-4">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Something went wrong!</AlertTitle>
                <AlertDescription>
                    {error.message || 'Failed to load campaign data. The Meta API might be unavailable.'}
                </AlertDescription>
            </Alert>
            <Button onClick={() => reset()} variant="outline">
                Try again
            </Button>
        </div>
    );
}
