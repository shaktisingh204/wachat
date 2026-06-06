'use client';

import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription } from '@/components/sabcrm/20ui/compat';
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
                <ZoruCardHeader>
                    <div className="mx-auto bg-[var(--st-text)]/10 text-[var(--st-text)] rounded-full h-16 w-16 flex items-center justify-center mb-4">
                        <AlertCircle className="h-10 w-10" />
                    </div>
                    <ZoruCardTitle className="text-2xl">Something went wrong!</ZoruCardTitle>
                    <ZoruCardDescription>
                        We encountered an error while loading your order confirmation.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <p className="text-sm text-[var(--st-text-secondary)]">{error.message || 'Unknown error occurred.'}</p>
                    <Button onClick={() => reset()} variant="default">
                        Try again
                    </Button>
                </ZoruCardContent>
            </Card>
        </div>
    )
}
