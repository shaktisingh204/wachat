'use client';
import { useEffect } from 'react';
import { Button, Alert, ZoruAlertTitle, ZoruAlertDescription } from '@/components/zoruui';
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
                <ZoruAlertTitle>Something went wrong!</ZoruAlertTitle>
                <ZoruAlertDescription>
                    {error.message || 'Failed to load campaign data. The Meta API might be unavailable.'}
                </ZoruAlertDescription>
            </Alert>
            <Button onClick={() => reset()} variant="outline">
                Try again
            </Button>
        </div>
    );
}
