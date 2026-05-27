'use client';

import { useEffect } from 'react';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Button } from '@/components/zoruui';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen bg-zoru-surface-2 flex items-center justify-center p-8 font-sans">
            <Card className="max-w-md w-full">
                <ZoruCardHeader>
                    <ZoruCardTitle className="text-zoru-ink">Something went wrong</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <p className="text-zoru-ink mb-6">
                        We encountered an error while trying to load the SEO status report.
                    </p>
                    <Button onClick={() => reset()}>
                        Try again
                    </Button>
                </ZoruCardContent>
            </Card>
        </div>
    );
}
