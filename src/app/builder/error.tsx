'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter } from '@/components/sabcrm/20ui';

export default function BuilderError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Builder root error:', error);
    }, [error]);

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-[var(--st-bg-secondary)] p-4">
            <Card className="max-w-md w-full">
                <CardHeader>
                    <CardTitle className="text-[var(--st-text)]">Something went wrong!</CardTitle>
                    <CardDescription>
                        We encountered an error while trying to load or create your project.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <div className="text-sm text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)] p-4 rounded-md overflow-auto break-all">
                        {error.message || 'Unknown error occurred'}
                    </div>
                </CardBody>
                <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
                        Go to Dashboard
                    </Button>
                    <Button onClick={() => reset()}>
                        Try again
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
