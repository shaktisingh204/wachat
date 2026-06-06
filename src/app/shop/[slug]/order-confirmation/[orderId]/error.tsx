'use client';

import { Button, Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <div className="container mx-auto px-4 py-12 flex justify-center min-h-[50vh] items-center">
             <Card className="w-full max-w-lg text-center border-destructive">
                <CardHeader>
                    <div className="mx-auto bg-[var(--st-text)]/10 text-[var(--st-text)] rounded-full h-16 w-16 flex items-center justify-center mb-4">
                        <AlertCircle className="h-10 w-10" />
                    </div>
                    <CardTitle className="text-2xl">Something went wrong!</CardTitle>
                    <CardDescription>
                        We encountered an error while loading your order confirmation.
                    </CardDescription>
                </CardHeader>
                <CardBody className="space-y-4">
                    <p className="text-sm text-[var(--st-text-secondary)]">{error.message || 'Unknown error occurred.'}</p>
                    <Button onClick={() => reset()} variant="default">
                        Try again
                    </Button>
                </CardBody>
            </Card>
        </div>
    )
}
