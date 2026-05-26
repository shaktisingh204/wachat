'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { Alert, AlertDescription, AlertTitle } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';

export default function NewTdsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('TDS New Error:', error);
    }, [error]);

    return (
        <div className="flex h-full w-full items-center justify-center p-6">
            <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Something went wrong!</AlertTitle>
                <AlertDescription className="mt-2 space-y-4">
                    <p>There was an error loading the new TDS form or processing data.</p>
                    <p className="text-xs font-mono bg-destructive/10 p-2 rounded">{error.message || 'Unknown error'}</p>
                    <Button onClick={() => reset()} variant="outline" className="w-full mt-4 bg-background">
                        Try again
                    </Button>
                </AlertDescription>
            </Alert>
        </div>
    );
}
