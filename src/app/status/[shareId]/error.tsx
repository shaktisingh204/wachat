'use client';

import { useEffect } from 'react';
import { Card, CardBody, CardHeader, CardTitle, Button } from '@/components/sabcrm/20ui/compat';

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
        <div className="min-h-screen bg-[var(--st-bg-muted)] flex items-center justify-center p-8 font-sans">
            <Card className="max-w-md w-full">
                <CardHeader>
                    <CardTitle className="text-[var(--st-text)]">Something went wrong</CardTitle>
                </CardHeader>
                <CardBody>
                    <p className="text-[var(--st-text)] mb-6">
                        We encountered an error while trying to load the SEO status report.
                    </p>
                    <Button onClick={() => reset()}>
                        Try again
                    </Button>
                </CardBody>
            </Card>
        </div>
    );
}
